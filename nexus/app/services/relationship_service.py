"""Service for managing table relationships and semantic graph traversal."""

import uuid
from collections import defaultdict, deque
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import structlog
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import db_manager, TableRelationship, RelationshipAuditLog

logger = structlog.get_logger()


class RelationshipService:
    """Service for managing table relationships and graph traversal."""

    def __init__(self):
        self.logger = logger.bind(service="relationship-service")

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def get_relationships(
        self,
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
        table: Optional[str] = None,
        method: Optional[str] = None,
        include_disabled: bool = False,
    ) -> List[Dict[str, Any]]:
        """List relationships with optional filters."""
        async with db_manager.get_session() as session:
            try:
                stmt = select(TableRelationship)
                conditions = []

                if not include_disabled:
                    conditions.append(TableRelationship.is_disabled == False)

                if catalog:
                    conditions.append(
                        or_(
                            TableRelationship.source_catalog == catalog,
                            TableRelationship.target_catalog == catalog,
                        )
                    )

                if schema:
                    conditions.append(
                        or_(
                            TableRelationship.source_schema == schema,
                            TableRelationship.target_schema == schema,
                        )
                    )

                if table:
                    conditions.append(
                        or_(
                            TableRelationship.source_table == table,
                            TableRelationship.target_table == table,
                        )
                    )

                if method:
                    conditions.append(TableRelationship.source_method == method)

                if conditions:
                    stmt = stmt.where(and_(*conditions))

                stmt = stmt.order_by(
                    TableRelationship.confidence.desc(),
                    TableRelationship.updated_at.desc(),
                )

                result = await session.execute(stmt)
                relationships = result.scalars().all()

                return [self._to_dict(r) for r in relationships]

            except Exception as e:
                self.logger.error("Failed to get relationships", error=str(e))
                raise

    async def get_relationship_by_id(self, relationship_id: int) -> Optional[Dict[str, Any]]:
        """Get single relationship."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(TableRelationship).where(
                        TableRelationship.id == relationship_id
                    )
                )
                rel = result.scalar_one_or_none()
                return self._to_dict(rel) if rel else None

            except Exception as e:
                self.logger.error(
                    "Failed to get relationship",
                    relationship_id=relationship_id,
                    error=str(e),
                )
                raise

    async def get_relationships_for_tables(
        self, table_full_names: List[str]
    ) -> List[Dict[str, Any]]:
        """Batch fetch all active relationships where source OR target is in the given table set.

        This is the method called by orchestration_service before LLM prompt building.
        table_full_names are in format 'catalog.schema.table'.
        """
        if not table_full_names:
            return []

        async with db_manager.get_session() as session:
            try:
                # Parse full names into (catalog, schema, table) tuples
                parsed = []
                for fn in table_full_names:
                    parts = fn.split(".")
                    if len(parts) == 3:
                        parsed.append(tuple(parts))

                if not parsed:
                    return []

                # Build OR conditions for each table
                source_conditions = []
                target_conditions = []
                for cat, sch, tbl in parsed:
                    source_conditions.append(
                        and_(
                            TableRelationship.source_catalog == cat,
                            TableRelationship.source_schema == sch,
                            TableRelationship.source_table == tbl,
                        )
                    )
                    target_conditions.append(
                        and_(
                            TableRelationship.target_catalog == cat,
                            TableRelationship.target_schema == sch,
                            TableRelationship.target_table == tbl,
                        )
                    )

                stmt = (
                    select(TableRelationship)
                    .where(
                        and_(
                            TableRelationship.is_disabled == False,
                            or_(*source_conditions, *target_conditions),
                        )
                    )
                    .order_by(TableRelationship.confidence.desc())
                )

                result = await session.execute(stmt)
                relationships = result.scalars().all()

                return [self._to_dict(r) for r in relationships]

            except Exception as e:
                self.logger.error(
                    "Failed to get relationships for tables",
                    table_count=len(table_full_names),
                    error=str(e),
                )
                raise

    async def create_relationship(
        self, data: Dict[str, Any], user_id: uuid.UUID = None
    ) -> Dict[str, Any]:
        """Create a new relationship (admin-curated)."""
        async with db_manager.get_session() as session:
            try:
                rel = TableRelationship(
                    source_catalog=data["source_catalog"],
                    source_schema=data["source_schema"],
                    source_table=data["source_table"],
                    target_catalog=data["target_catalog"],
                    target_schema=data["target_schema"],
                    target_table=data["target_table"],
                    join_condition=data["join_condition"],
                    relationship_type=data.get("relationship_type", "1:N"),
                    source_method=data.get("source_method", "admin"),
                    confidence=data.get("confidence", 1.0),
                    is_verified=data.get("is_verified", False),
                    created_by=user_id,
                    updated_by=user_id,
                )

                session.add(rel)
                await session.flush()

                # Audit log
                if user_id:
                    await self._log_audit(
                        session,
                        relationship_id=rel.id,
                        action="created",
                        old_values=None,
                        new_values=self._to_dict(rel),
                        user_id=user_id,
                    )

                await session.commit()

                self.logger.info(
                    "Relationship created",
                    id=rel.id,
                    source=f"{rel.source_catalog}.{rel.source_schema}.{rel.source_table}",
                    target=f"{rel.target_catalog}.{rel.target_schema}.{rel.target_table}",
                )

                return self._to_dict(rel)

            except Exception as e:
                await session.rollback()
                self.logger.error("Failed to create relationship", error=str(e))
                raise

    async def update_relationship(
        self, relationship_id: int, data: Dict[str, Any], user_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Update relationship fields."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(TableRelationship).where(
                        TableRelationship.id == relationship_id
                    )
                )
                rel = result.scalar_one_or_none()
                if not rel:
                    return None

                old_values = self._to_dict(rel)

                # Allowed update fields
                allowed = {
                    "join_condition",
                    "relationship_type",
                    "confidence",
                    "is_verified",
                    "is_disabled",
                    "source_method",
                }
                for key, value in data.items():
                    if key in allowed:
                        setattr(rel, key, value)

                rel.updated_by = user_id
                rel.updated_at = datetime.utcnow()

                await session.flush()

                await self._log_audit(
                    session,
                    relationship_id=rel.id,
                    action="updated",
                    old_values=old_values,
                    new_values=self._to_dict(rel),
                    user_id=user_id,
                )

                await session.commit()

                self.logger.info("Relationship updated", id=relationship_id)
                return self._to_dict(rel)

            except Exception as e:
                await session.rollback()
                self.logger.error(
                    "Failed to update relationship",
                    relationship_id=relationship_id,
                    error=str(e),
                )
                raise

    async def verify_relationship(
        self, relationship_id: int, user_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Mark as admin-verified (sets confidence=1.0, is_verified=True)."""
        return await self.update_relationship(
            relationship_id,
            {"confidence": 1.0, "is_verified": True},
            user_id,
        )

    async def disable_relationship(
        self, relationship_id: int, user_id: uuid.UUID
    ) -> Optional[Dict[str, Any]]:
        """Disable a relationship (soft delete)."""
        return await self.update_relationship(
            relationship_id,
            {"is_disabled": True},
            user_id,
        )

    async def delete_relationship(
        self, relationship_id: int, user_id: uuid.UUID
    ) -> bool:
        """Hard delete a relationship."""
        async with db_manager.get_session() as session:
            try:
                result = await session.execute(
                    select(TableRelationship).where(
                        TableRelationship.id == relationship_id
                    )
                )
                rel = result.scalar_one_or_none()
                if not rel:
                    return False

                old_values = self._to_dict(rel)

                # Audit log before delete (cascade will remove audit entries,
                # but we log the delete action first for traceability)
                await self._log_audit(
                    session,
                    relationship_id=rel.id,
                    action="deleted",
                    old_values=old_values,
                    new_values=None,
                    user_id=user_id,
                )

                await session.delete(rel)
                await session.commit()

                self.logger.info("Relationship deleted", id=relationship_id)
                return True

            except Exception as e:
                await session.rollback()
                self.logger.error(
                    "Failed to delete relationship",
                    relationship_id=relationship_id,
                    error=str(e),
                )
                raise

    # =========================================================================
    # Graph Traversal
    # =========================================================================

    def find_join_paths(
        self, table_full_names: Set[str], relationships: List[Dict[str, Any]]
    ) -> List[str]:
        """Given a set of tables and their relationships, find optimal join paths using BFS.

        Returns ordered list of join statements like:
            'orders JOIN customers ON orders.customer_id = customers.id'

        This is a pure function (no DB access) -- works on the relationships already fetched.
        """
        if len(table_full_names) < 2 or not relationships:
            return []

        # Build adjacency list (treat as undirected, weighted by inverse confidence)
        adjacency: Dict[str, List[tuple]] = defaultdict(list)
        edge_map: Dict[tuple, Dict[str, Any]] = {}

        for rel in relationships:
            source = f"{rel['source_catalog']}.{rel['source_schema']}.{rel['source_table']}"
            target = f"{rel['target_catalog']}.{rel['target_schema']}.{rel['target_table']}"
            weight = 1.0 - rel.get("confidence", 0.5)  # lower weight = better

            adjacency[source].append((target, weight))
            adjacency[target].append((source, weight))
            edge_map[(source, target)] = rel
            edge_map[(target, source)] = rel

        # BFS from the first table to find shortest paths to all other tables in the set
        tables_list = list(table_full_names)
        start = tables_list[0]
        remaining = set(tables_list[1:])

        visited: Set[str] = {start}
        queue: deque = deque()
        queue.append((start, []))
        join_edges: List[tuple] = []

        while queue and remaining:
            current, path = queue.popleft()

            # Sort neighbors by weight (prefer high-confidence edges)
            neighbors = sorted(adjacency.get(current, []), key=lambda x: x[1])

            for neighbor, weight in neighbors:
                if neighbor in visited:
                    continue

                new_path = path + [(current, neighbor)]
                visited.add(neighbor)

                if neighbor in remaining:
                    # Found a path to one of our target tables
                    join_edges.extend(new_path)
                    remaining.discard(neighbor)

                queue.append((neighbor, new_path))

        # Deduplicate edges while preserving order
        seen_edges: Set[tuple] = set()
        unique_edges: List[tuple] = []
        for edge in join_edges:
            normalized = tuple(sorted(edge))
            if normalized not in seen_edges:
                seen_edges.add(normalized)
                unique_edges.append(edge)

        # Convert to JOIN strings
        join_strings = []
        for src, tgt in unique_edges:
            rel = edge_map.get((src, tgt)) or edge_map.get((tgt, src))
            if rel:
                # Use short table names for readability
                src_table = rel["source_table"]
                tgt_table = rel["target_table"]
                src_full = f"{rel['source_catalog']}.{rel['source_schema']}.{rel['source_table']}"
                tgt_full = f"{rel['target_catalog']}.{rel['target_schema']}.{rel['target_table']}"

                # Determine which is left vs right in the JOIN
                if src_full == src:
                    join_strings.append(
                        f"{src_table} JOIN {tgt_table} ON {rel['join_condition']}"
                    )
                else:
                    join_strings.append(
                        f"{tgt_table} JOIN {src_table} ON {rel['join_condition']}"
                    )

        return join_strings

    # =========================================================================
    # Convention Inference
    # =========================================================================

    async def run_convention_inference(
        self,
        catalog: str,
        schema: Optional[str] = None,
        tables_metadata: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Infer relationships from column naming conventions.

        Enhanced patterns: *_id, *_uuid, *_fk, junction table detection.
        Upserts: if relationship already exists with higher confidence (admin/mined), skip.

        Args:
            catalog: Catalog to infer relationships for
            schema: Optional schema filter
            tables_metadata: List of dicts with keys: full_name, table_name, columns (list of column names)

        Returns:
            Summary of what was created/skipped
        """
        if not tables_metadata:
            return {"created": 0, "skipped": 0, "errors": []}

        created = 0
        skipped = 0
        errors = []

        # Build lookup: table_name -> full metadata
        table_lookup: Dict[str, Dict[str, Any]] = {}
        table_names: Set[str] = set()
        for t in tables_metadata:
            tname = t.get("table_name", "").lower()
            table_lookup[tname] = t
            table_names.add(tname)

        # Also build pluralized/singularized variants for matching
        name_to_table: Dict[str, str] = {}
        for tname in table_names:
            name_to_table[tname] = tname
            # Simple singular/plural heuristics
            if tname.endswith("s"):
                name_to_table[tname[:-1]] = tname  # orders -> order -> orders
            else:
                name_to_table[tname + "s"] = tname  # order -> orders -> order
            if tname.endswith("ies"):
                name_to_table[tname[:-3] + "y"] = tname  # categories -> category
            elif tname.endswith("y") and not tname.endswith("ey"):
                name_to_table[tname[:-1] + "ies"] = tname

        inferred_rels: List[Dict[str, Any]] = []

        for table_meta in tables_metadata:
            src_table = table_meta.get("table_name", "")
            src_full = table_meta.get("full_name", "")
            columns = table_meta.get("columns", [])
            src_parts = src_full.split(".")

            if len(src_parts) != 3:
                continue

            src_cat, src_sch, src_tbl = src_parts

            # Pattern 1: column ending in _id, _uuid, _fk
            for col in columns:
                col_lower = col.lower()
                ref_name = None

                for suffix in ("_id", "_uuid", "_fk"):
                    if col_lower.endswith(suffix):
                        ref_name = col_lower[: -len(suffix)]
                        break

                if not ref_name or ref_name == src_table.lower():
                    continue

                target_table_name = name_to_table.get(ref_name)
                if not target_table_name:
                    continue

                target_meta = table_lookup.get(target_table_name)
                if not target_meta:
                    continue

                target_full = target_meta.get("full_name", "")
                tgt_parts = target_full.split(".")
                if len(tgt_parts) != 3:
                    continue

                tgt_cat, tgt_sch, tgt_tbl = tgt_parts

                # Build join condition
                join_cond = f"{src_tbl}.{col} = {tgt_tbl}.id"

                inferred_rels.append({
                    "source_catalog": src_cat,
                    "source_schema": src_sch,
                    "source_table": src_tbl,
                    "target_catalog": tgt_cat,
                    "target_schema": tgt_sch,
                    "target_table": tgt_tbl,
                    "join_condition": join_cond,
                    "relationship_type": "N:1",
                    "confidence": 0.6,
                })

            # Pattern 2: junction tables (name with _ splitting into two known table names)
            src_lower = src_table.lower()
            if "_" in src_lower:
                parts = src_lower.split("_", 1)
                left_name = name_to_table.get(parts[0])
                right_name = name_to_table.get(parts[1])

                if (
                    left_name
                    and right_name
                    and left_name != src_lower
                    and right_name != src_lower
                ):
                    left_meta = table_lookup.get(left_name)
                    right_meta = table_lookup.get(right_name)

                    if left_meta and right_meta:
                        left_full = left_meta.get("full_name", "").split(".")
                        right_full = right_meta.get("full_name", "").split(".")

                        if len(left_full) == 3 and len(right_full) == 3:
                            # junction -> left
                            inferred_rels.append({
                                "source_catalog": src_cat,
                                "source_schema": src_sch,
                                "source_table": src_tbl,
                                "target_catalog": left_full[0],
                                "target_schema": left_full[1],
                                "target_table": left_full[2],
                                "join_condition": f"{src_tbl}.{left_name}_id = {left_full[2]}.id",
                                "relationship_type": "M:N",
                                "confidence": 0.4,
                            })
                            # junction -> right
                            inferred_rels.append({
                                "source_catalog": src_cat,
                                "source_schema": src_sch,
                                "source_table": src_tbl,
                                "target_catalog": right_full[0],
                                "target_schema": right_full[1],
                                "target_table": right_full[2],
                                "join_condition": f"{src_tbl}.{right_name}_id = {right_full[2]}.id",
                                "relationship_type": "M:N",
                                "confidence": 0.4,
                            })

        # Upsert inferred relationships
        if inferred_rels:
            async with db_manager.get_session() as session:
                try:
                    for rel_data in inferred_rels:
                        # Check if relationship already exists
                        existing = await session.execute(
                            select(TableRelationship).where(
                                and_(
                                    TableRelationship.source_catalog == rel_data["source_catalog"],
                                    TableRelationship.source_schema == rel_data["source_schema"],
                                    TableRelationship.source_table == rel_data["source_table"],
                                    TableRelationship.target_catalog == rel_data["target_catalog"],
                                    TableRelationship.target_schema == rel_data["target_schema"],
                                    TableRelationship.target_table == rel_data["target_table"],
                                    TableRelationship.join_condition == rel_data["join_condition"],
                                )
                            )
                        )
                        existing_rel = existing.scalar_one_or_none()

                        if existing_rel:
                            # Skip if existing has higher confidence (admin/mined)
                            if existing_rel.confidence >= rel_data["confidence"]:
                                skipped += 1
                                continue
                            # Update confidence if our inference is somehow higher
                            existing_rel.confidence = rel_data["confidence"]
                            existing_rel.updated_at = datetime.utcnow()
                            created += 1
                        else:
                            new_rel = TableRelationship(
                                source_catalog=rel_data["source_catalog"],
                                source_schema=rel_data["source_schema"],
                                source_table=rel_data["source_table"],
                                target_catalog=rel_data["target_catalog"],
                                target_schema=rel_data["target_schema"],
                                target_table=rel_data["target_table"],
                                join_condition=rel_data["join_condition"],
                                relationship_type=rel_data["relationship_type"],
                                source_method="inferred",
                                confidence=rel_data["confidence"],
                            )
                            session.add(new_rel)
                            created += 1

                    await session.commit()

                except Exception as e:
                    await session.rollback()
                    self.logger.error("Convention inference failed", error=str(e))
                    errors.append(str(e))

        self.logger.info(
            "Convention inference completed",
            catalog=catalog,
            schema=schema,
            created=created,
            skipped=skipped,
            errors=len(errors),
        )

        return {"created": created, "skipped": skipped, "errors": errors}

    # =========================================================================
    # Audit Logging
    # =========================================================================

    async def _log_audit(
        self,
        session: AsyncSession,
        relationship_id: int,
        action: str,
        old_values: Optional[Dict[str, Any]],
        new_values: Optional[Dict[str, Any]],
        user_id: uuid.UUID,
    ):
        """Write to relationship_audit_log."""
        audit = RelationshipAuditLog(
            relationship_id=relationship_id,
            action=action,
            old_values=old_values,
            new_values=new_values,
            changed_by=user_id,
        )
        session.add(audit)
        await session.flush()

    # =========================================================================
    # Helpers
    # =========================================================================

    @staticmethod
    def _to_dict(rel: TableRelationship) -> Dict[str, Any]:
        """Convert a TableRelationship ORM object to a dictionary."""
        return {
            "id": rel.id,
            "source_catalog": rel.source_catalog,
            "source_schema": rel.source_schema,
            "source_table": rel.source_table,
            "target_catalog": rel.target_catalog,
            "target_schema": rel.target_schema,
            "target_table": rel.target_table,
            "join_condition": rel.join_condition,
            "relationship_type": rel.relationship_type,
            "source_method": rel.source_method,
            "confidence": rel.confidence,
            "is_verified": rel.is_verified,
            "is_disabled": rel.is_disabled,
            "usage_count": rel.usage_count,
            "last_used_at": rel.last_used_at.isoformat() if rel.last_used_at else None,
            "created_by": str(rel.created_by) if rel.created_by else None,
            "updated_by": str(rel.updated_by) if rel.updated_by else None,
            "created_at": rel.created_at.isoformat() if rel.created_at else None,
            "updated_at": rel.updated_at.isoformat() if rel.updated_at else None,
            "source_full_name": f"{rel.source_catalog}.{rel.source_schema}.{rel.source_table}",
            "target_full_name": f"{rel.target_catalog}.{rel.target_schema}.{rel.target_table}",
        }


# Global service instance
relationship_service = RelationshipService()
