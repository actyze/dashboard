"""Service for mining table relationships from query history."""

import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import structlog
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import db_manager, QueryHistory, TableRelationship

logger = structlog.get_logger()

# Try sqlglot for robust SQL parsing; fall back to regex if unavailable
try:
    import sqlglot
    from sqlglot import exp
    SQLGLOT_AVAILABLE = True
except ImportError:
    SQLGLOT_AVAILABLE = False
    sqlglot = None


class RelationshipMiningService:
    """Mines JOIN patterns from successful query history to discover table relationships."""

    def __init__(self):
        self.logger = logger.bind(service="relationship-mining-service")

    # =========================================================================
    # Main entry point
    # =========================================================================

    async def mine_query_history(self, limit: int = 1000) -> Dict[str, Any]:
        """Parse successful SQL from query_history, extract JOIN patterns, populate graph.

        Returns summary of mining results.
        """
        self.logger.info("Starting query history mining", limit=limit)

        # Step 1: Fetch successful queries
        queries = await self._fetch_successful_queries(limit)
        if not queries:
            self.logger.info("No successful queries found for mining")
            return {"created": 0, "updated": 0, "skipped": 0, "queries_parsed": 0, "errors": []}

        # Step 2: Parse each query and extract JOIN patterns
        all_patterns: List[Tuple[str, str, str, str, str, str, str]] = []
        parse_errors = 0

        for sql_text in queries:
            try:
                patterns = self._extract_join_patterns(sql_text)
                all_patterns.extend(patterns)
            except Exception as e:
                parse_errors += 1
                self.logger.debug("Failed to parse query", error=str(e), sql=sql_text[:100])

        self.logger.info(
            "JOIN pattern extraction complete",
            total_queries=len(queries),
            total_patterns=len(all_patterns),
            parse_errors=parse_errors,
        )

        # Step 3: Count occurrences of each unique pattern
        pattern_counts = Counter(all_patterns)

        # Step 4: Upsert relationships with frequency-based confidence
        created = 0
        updated = 0
        skipped = 0
        errors: List[str] = []

        async with db_manager.get_session() as session:
            try:
                for pattern, count in pattern_counts.items():
                    src_cat, src_sch, src_tbl, tgt_cat, tgt_sch, tgt_tbl, join_cond = pattern
                    confidence = min(0.9, 0.5 + 0.05 * count)

                    result = await self._upsert_relationship(
                        session,
                        src_cat, src_sch, src_tbl,
                        tgt_cat, tgt_sch, tgt_tbl,
                        join_cond, confidence, count,
                    )
                    if result == "created":
                        created += 1
                    elif result == "updated":
                        updated += 1
                    else:
                        skipped += 1

                await session.commit()
            except Exception as e:
                await session.rollback()
                self.logger.error("Mining upsert failed", error=str(e))
                errors.append(str(e))

        summary = {
            "created": created,
            "updated": updated,
            "skipped": skipped,
            "queries_parsed": len(queries),
            "patterns_found": len(pattern_counts),
            "parse_errors": parse_errors,
            "errors": errors,
        }

        self.logger.info("Query history mining complete", **summary)
        return summary

    # =========================================================================
    # Data access
    # =========================================================================

    async def _fetch_successful_queries(self, limit: int) -> List[str]:
        """Fetch generated_sql from successful query history entries."""
        async with db_manager.get_session() as session:
            stmt = (
                select(QueryHistory.generated_sql)
                .where(QueryHistory.execution_status == "SUCCESS")
                .order_by(QueryHistory.created_at.desc())
                .limit(limit)
            )
            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [sql for sql in rows if sql and sql.strip()]

    # =========================================================================
    # SQL Parsing
    # =========================================================================

    def _extract_join_patterns(self, sql: str) -> List[Tuple[str, str, str, str, str, str, str]]:
        """Extract JOIN patterns from a SQL string.

        Returns list of tuples:
            (src_catalog, src_schema, src_table, tgt_catalog, tgt_schema, tgt_table, join_condition)
        """
        if SQLGLOT_AVAILABLE:
            try:
                return self._extract_with_sqlglot(sql)
            except Exception:
                # Fall through to regex
                pass

        return self._extract_with_regex(sql)

    def _extract_with_sqlglot(self, sql: str) -> List[Tuple[str, str, str, str, str, str, str]]:
        """Use sqlglot to parse SQL and extract JOIN clauses."""
        patterns = []

        try:
            parsed = sqlglot.parse(sql, error_level=sqlglot.ErrorLevel.IGNORE)
        except Exception:
            return []

        for statement in parsed:
            if statement is None:
                continue

            # Find all JOIN expressions
            for join_node in statement.find_all(exp.Join):
                on_clause = join_node.args.get("on")
                if on_clause is None:
                    continue

                # Get the table being joined
                join_table_node = join_node.find(exp.Table)
                if join_table_node is None:
                    continue

                join_table_parts = self._parse_table_node(join_table_node)
                if not join_table_parts:
                    continue

                # Extract column equalities from ON clause to find the source table
                eq_nodes = list(on_clause.find_all(exp.EQ))
                if not eq_nodes:
                    # Try to get a string representation as join condition
                    join_cond_str = on_clause.sql()
                    # We can't determine source table reliably; skip
                    continue

                for eq_node in eq_nodes:
                    left = eq_node.left
                    right = eq_node.right

                    left_col = self._extract_column_info(left)
                    right_col = self._extract_column_info(right)

                    if not left_col or not right_col:
                        continue

                    left_table, left_col_name = left_col
                    right_table, right_col_name = right_col

                    # Resolve which side is source vs target
                    # The join_table is the target; the other is the source
                    jt_cat, jt_sch, jt_tbl = join_table_parts

                    if right_table and right_table.lower() == jt_tbl.lower():
                        src_tbl_name = left_table or "unknown"
                        src_col = left_col_name
                        tgt_col = right_col_name
                    elif left_table and left_table.lower() == jt_tbl.lower():
                        src_tbl_name = right_table or "unknown"
                        src_col = right_col_name
                        tgt_col = left_col_name
                    else:
                        # Cannot determine source; use left as source
                        src_tbl_name = left_table or "unknown"
                        src_col = left_col_name
                        tgt_col = right_col_name

                    # Try to find the source table in the FROM clause for full qualification
                    src_parts = self._resolve_table_in_statement(statement, src_tbl_name)
                    if not src_parts:
                        src_parts = ("unknown", "unknown", src_tbl_name)

                    join_cond = f"{src_parts[2]}.{src_col} = {jt_tbl}.{tgt_col}"

                    patterns.append((
                        src_parts[0], src_parts[1], src_parts[2],
                        jt_cat, jt_sch, jt_tbl,
                        join_cond,
                    ))

        return patterns

    def _parse_table_node(self, table_node: "exp.Table") -> Optional[Tuple[str, str, str]]:
        """Extract (catalog, schema, table) from a sqlglot Table node."""
        table_name = table_node.name
        if not table_name:
            return None

        db = table_node.args.get("db")
        catalog = table_node.args.get("catalog")

        schema_name = db.name if db else "unknown"
        catalog_name = catalog.name if catalog else "unknown"

        return (catalog_name, schema_name, table_name)

    def _extract_column_info(self, node) -> Optional[Tuple[str, str]]:
        """Extract (table_name_or_alias, column_name) from a column node."""
        if isinstance(node, exp.Column):
            col_name = node.name
            table_ref = node.args.get("table")
            table_name = table_ref.name if table_ref else None
            return (table_name, col_name)
        return None

    def _resolve_table_in_statement(
        self, statement, alias_or_name: str
    ) -> Optional[Tuple[str, str, str]]:
        """Try to resolve a table alias or name to (catalog, schema, table) in the statement."""
        if not alias_or_name:
            return None

        for table_node in statement.find_all(exp.Table):
            alias = table_node.alias
            name = table_node.name

            if alias and alias.lower() == alias_or_name.lower():
                return self._parse_table_node(table_node)
            if name and name.lower() == alias_or_name.lower():
                return self._parse_table_node(table_node)

        return None

    def _extract_with_regex(self, sql: str) -> List[Tuple[str, str, str, str, str, str, str]]:
        """Regex fallback for extracting JOIN patterns from SQL.

        Catches common patterns:
            FROM catalog.schema.table [alias] JOIN catalog.schema.table [alias] ON ...
        """
        patterns = []

        # Qualified table name: catalog.schema.table (or just schema.table or table)
        qualified = r'([\w]+(?:\.[\w]+){0,2})'
        alias = r'(?:\s+(?:AS\s+)?(\w+))?'

        # Match JOIN ... ON ... = ...
        join_re = re.compile(
            r'JOIN\s+' + qualified + alias +
            r'\s+ON\s+' +
            r'([\w.]+)\s*=\s*([\w.]+)',
            re.IGNORECASE,
        )

        # Also capture FROM table to know the source
        from_re = re.compile(
            r'FROM\s+' + qualified + alias,
            re.IGNORECASE,
        )

        # Build alias map from FROM and JOIN clauses
        alias_map: Dict[str, str] = {}
        for m in from_re.finditer(sql):
            full_name = m.group(1)
            al = m.group(2)
            if al:
                alias_map[al.lower()] = full_name
            short = full_name.split(".")[-1]
            alias_map[short.lower()] = full_name

        for m in re.finditer(r'JOIN\s+' + qualified + alias, sql, re.IGNORECASE):
            full_name = m.group(1)
            al = m.group(2)
            if al:
                alias_map[al.lower()] = full_name
            short = full_name.split(".")[-1]
            alias_map[short.lower()] = full_name

        for m in join_re.finditer(sql):
            target_full = m.group(1)
            _target_alias = m.group(2)
            left_ref = m.group(3)   # e.g. a.customer_id
            right_ref = m.group(4)  # e.g. b.id

            # Parse left/right into (table_ref, column)
            left_parts = left_ref.rsplit(".", 1)
            right_parts = right_ref.rsplit(".", 1)

            if len(left_parts) != 2 or len(right_parts) != 2:
                continue

            left_tbl_ref, left_col = left_parts
            right_tbl_ref, right_col = right_parts

            # Resolve target table
            tgt_parts = self._split_qualified_name(target_full)

            # Determine source: the side that is NOT the target table
            tgt_short = tgt_parts[2].lower()
            target_alias_lower = (_target_alias or "").lower()

            if right_tbl_ref.lower() in (tgt_short, target_alias_lower):
                # right side is target, left side is source
                src_full = alias_map.get(left_tbl_ref.lower(), left_tbl_ref)
                src_parts = self._split_qualified_name(src_full)
                join_cond = f"{src_parts[2]}.{left_col} = {tgt_parts[2]}.{right_col}"
            elif left_tbl_ref.lower() in (tgt_short, target_alias_lower):
                # left side is target, right side is source
                src_full = alias_map.get(right_tbl_ref.lower(), right_tbl_ref)
                src_parts = self._split_qualified_name(src_full)
                join_cond = f"{src_parts[2]}.{right_col} = {tgt_parts[2]}.{left_col}"
            else:
                # Cannot determine; use left as source
                src_full = alias_map.get(left_tbl_ref.lower(), left_tbl_ref)
                src_parts = self._split_qualified_name(src_full)
                join_cond = f"{src_parts[2]}.{left_col} = {tgt_parts[2]}.{right_col}"

            patterns.append((
                src_parts[0], src_parts[1], src_parts[2],
                tgt_parts[0], tgt_parts[1], tgt_parts[2],
                join_cond,
            ))

        return patterns

    @staticmethod
    def _split_qualified_name(name: str) -> Tuple[str, str, str]:
        """Split a potentially qualified name into (catalog, schema, table).

        Handles: 'catalog.schema.table', 'schema.table', 'table'
        """
        parts = name.split(".")
        if len(parts) == 3:
            return (parts[0], parts[1], parts[2])
        elif len(parts) == 2:
            return ("unknown", parts[0], parts[1])
        else:
            return ("unknown", "unknown", parts[0])

    # =========================================================================
    # Upsert logic
    # =========================================================================

    async def _upsert_relationship(
        self,
        session: AsyncSession,
        src_cat: str, src_sch: str, src_tbl: str,
        tgt_cat: str, tgt_sch: str, tgt_tbl: str,
        join_cond: str, confidence: float, occurrence_count: int,
    ) -> str:
        """Upsert a mined relationship. Returns 'created', 'updated', or 'skipped'."""

        # Check for existing relationship (same tables + join condition)
        existing_result = await session.execute(
            select(TableRelationship).where(
                and_(
                    TableRelationship.source_catalog == src_cat,
                    TableRelationship.source_schema == src_sch,
                    TableRelationship.source_table == src_tbl,
                    TableRelationship.target_catalog == tgt_cat,
                    TableRelationship.target_schema == tgt_sch,
                    TableRelationship.target_table == tgt_tbl,
                    TableRelationship.join_condition == join_cond,
                )
            )
        )
        existing = existing_result.scalar_one_or_none()

        if existing:
            # Skip if admin-curated with higher confidence
            if existing.source_method == "admin" and existing.confidence >= confidence:
                return "skipped"

            # Skip if already verified
            if existing.is_verified:
                return "skipped"

            # Update confidence and usage if our mined confidence is higher
            if confidence > existing.confidence or existing.source_method == "mined":
                existing.confidence = confidence
                existing.usage_count = existing.usage_count + occurrence_count
                existing.source_method = "mined"
                existing.updated_at = datetime.utcnow()
                return "updated"

            return "skipped"

        # Create new mined relationship
        new_rel = TableRelationship(
            source_catalog=src_cat,
            source_schema=src_sch,
            source_table=src_tbl,
            target_catalog=tgt_cat,
            target_schema=tgt_sch,
            target_table=tgt_tbl,
            join_condition=join_cond,
            relationship_type="1:N",  # Default; can be refined later
            source_method="mined",
            confidence=confidence,
            usage_count=occurrence_count,
        )
        session.add(new_rel)
        return "created"


# Global service instance
mining_service = RelationshipMiningService()
