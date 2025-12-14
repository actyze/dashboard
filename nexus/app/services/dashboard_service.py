"""
Dashboard Service - CRUD operations with RBAC
Handles dashboards, tiles, and permissions
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy import text, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import db_manager
import logging
import json

logger = logging.getLogger(__name__)


class DashboardService:
    """Service for managing dashboards with RBAC"""
    
    # =========================================================================
    # ANONYMOUS/PUBLIC ACCESS (No Authentication Required)
    # =========================================================================
    
    async def get_anonymous_public_dashboards(self) -> List[Dict[str, Any]]:
        """Get all anonymous-public dashboards (no authentication required)"""
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT * FROM nexus.get_anonymous_public_dashboards()
                """)
                
                result = await session.execute(query)
                
                dashboards = []
                for row in result:
                    dashboards.append({
                        "id": str(row.dashboard_id),
                        "title": row.title,
                        "description": row.description,
                        "layout_config": row.layout_config,
                        "tags": row.tags or [],
                        "tile_count": row.tile_count,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat() if row.updated_at else None
                    })
                
                return dashboards
                
        except Exception as e:
            logger.error(f"Failed to get anonymous public dashboards: {str(e)}")
            raise
    
    async def get_anonymous_public_dashboard_by_id(self, dashboard_id: str) -> Optional[Dict[str, Any]]:
        """Get anonymous-public dashboard by ID (no authentication required)"""
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        d.*,
                        (SELECT COUNT(*) FROM nexus.dashboard_tiles dt WHERE dt.dashboard_id = d.id) as tile_count
                    FROM nexus.dashboards d
                    WHERE d.id = :dashboard_id AND d.is_anonymous_public = TRUE
                """)
                
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                row = result.fetchone()
                
                if not row:
                    return None
                
                # Update last_accessed_at
                await session.execute(
                    text("UPDATE nexus.dashboards SET last_accessed_at = NOW() WHERE id = :dashboard_id"),
                    {"dashboard_id": dashboard_id}
                )
                await session.commit()
                
                return {
                    "id": str(row.id),
                    "title": row.title,
                    "description": row.description,
                    "layout_config": row.layout_config,
                    "tags": row.tags or [],
                    "tile_count": row.tile_count,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None
                }
                
        except Exception as e:
            logger.error(f"Failed to get anonymous public dashboard: {str(e)}")
            raise
    
    async def get_anonymous_public_tiles(self, dashboard_id: str) -> List[Dict[str, Any]]:
        """Get tiles for anonymous-public dashboard (no authentication required)"""
        try:
            async with db_manager.get_session() as session:
                # First verify dashboard is anonymous-public
                verify_query = text("""
                    SELECT is_anonymous_public FROM nexus.dashboards WHERE id = :dashboard_id
                """)
                result = await session.execute(verify_query, {"dashboard_id": dashboard_id})
                row = result.fetchone()
                
                if not row or not row[0]:
                    return []  # Not anonymous-public
                
                # Get tiles
                query = text("""
                    SELECT 
                        dt.id, dt.title, dt.description, dt.sql_query,
                        dt.chart_type, dt.chart_config, 
                        dt.position_x, dt.position_y, dt.width, dt.height,
                        dt.refresh_interval_seconds, dt.last_refreshed_at
                    FROM nexus.dashboard_tiles dt
                    WHERE dt.dashboard_id = :dashboard_id
                    ORDER BY dt.position_y, dt.position_x
                """)
                
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                
                tiles = []
                for row in result:
                    tiles.append({
                        "id": str(row.id),
                        "title": row.title,
                        "description": row.description,
                        "sql_query": row.sql_query,
                        "chart_type": row.chart_type,
                        "chart_config": row.chart_config,
                        "position": {
                            "x": row.position_x,
                            "y": row.position_y,
                            "width": row.width,
                            "height": row.height
                        },
                        "refresh_interval_seconds": row.refresh_interval_seconds,
                        "last_refreshed_at": row.last_refreshed_at.isoformat() if row.last_refreshed_at else None
                    })
                
                return tiles
                
        except Exception as e:
            logger.error(f"Failed to get anonymous public tiles: {str(e)}")
            raise
    
    # =========================================================================
    # DASHBOARD CRUD (Authenticated)
    # =========================================================================
    
    async def get_user_dashboards(
        self, 
        user_id: str,
        include_public: bool = True,
        favorites_only: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get all dashboards accessible by user with RBAC verification
        Uses the SQL function nexus.get_user_dashboards()
        """
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT * FROM nexus.get_user_dashboards(:user_id)
                    WHERE (:include_public = TRUE OR is_public = TRUE OR owner_user_id = :user_id)
                    AND (:favorites_only = FALSE OR is_favorite = TRUE)
                    ORDER BY updated_at DESC
                """)
                
                result = await session.execute(
                    query,
                    {
                        "user_id": user_id,
                        "include_public": include_public,
                        "favorites_only": favorites_only
                    }
                )
                
                dashboards = []
                for row in result:
                    dashboards.append({
                        "id": str(row.dashboard_id),
                        "title": row.title,
                        "description": row.description,
                        "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
                        "owner_username": row.owner_username,
                        "is_public": row.is_public,
                        "is_anonymous_public": getattr(row, 'is_anonymous_public', False),
                        "is_favorite": row.is_favorite,
                        "tags": row.tags or [],
                        "tile_count": row.tile_count,
                        "permissions": {
                            "can_view": row.can_view,
                            "can_edit": row.can_edit,
                            "can_delete": row.can_delete,
                            "can_share": row.can_share
                        },
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                        "last_accessed_at": row.last_accessed_at.isoformat() if row.last_accessed_at else None
                    })
                
                return dashboards
                
        except Exception as e:
            logger.error(f"Failed to get user dashboards: {str(e)}")
            raise
    
    async def get_dashboard_by_id(
        self, 
        dashboard_id: str, 
        user_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get dashboard by ID with permission check"""
        try:
            # Check permission first
            has_permission = await self.check_permission(user_id, dashboard_id, "view")
            if not has_permission:
                return None
            
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        d.*,
                        u.username as owner_username,
                        COUNT(dt.id) as tile_count
                    FROM nexus.dashboards d
                    LEFT JOIN nexus.users u ON d.owner_user_id = u.id
                    LEFT JOIN nexus.dashboard_tiles dt ON d.id = dt.dashboard_id
                    WHERE d.id = :dashboard_id
                    GROUP BY d.id, u.username
                """)
                
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                row = result.fetchone()
                
                if not row:
                    return None
                
                # Update last_accessed_at
                await session.execute(
                    text("UPDATE nexus.dashboards SET last_accessed_at = NOW() WHERE id = :dashboard_id"),
                    {"dashboard_id": dashboard_id}
                )
                await session.commit()
                
                # Get user permissions
                permissions = await self._get_user_permissions(user_id, dashboard_id)
                
                return {
                    "id": str(row.id),
                    "title": row.title,
                    "description": row.description,
                    "configuration": row.configuration,
                    "layout_config": row.layout_config,
                    "owner_user_id": str(row.owner_user_id) if row.owner_user_id else None,
                    "owner_username": row.owner_username,
                    "owner_group_id": str(row.owner_group_id) if row.owner_group_id else None,
                    "is_public": row.is_public,
                    "is_anonymous_public": getattr(row, 'is_anonymous_public', False),
                    "is_favorite": row.is_favorite,
                    "tags": row.tags or [],
                    "tile_count": row.tile_count,
                    "status": row.status,
                    "version": row.version,
                    "published_at": row.published_at.isoformat() if row.published_at else None,
                    "published_by": str(row.published_by) if row.published_by else None,
                    "permissions": permissions,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                    "last_accessed_at": row.last_accessed_at.isoformat() if row.last_accessed_at else None
                }
                
        except Exception as e:
            logger.error(f"Failed to get dashboard {dashboard_id}: {str(e)}")
            raise
    
    async def create_dashboard(
        self,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        configuration: Optional[Dict[str, Any]] = None,
        layout_config: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        is_public: bool = False,
        owner_group_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create new dashboard"""
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    INSERT INTO nexus.dashboards (
                        title, description, configuration, layout_config, 
                        owner_user_id, owner_group_id, is_public, tags
                    )
                    VALUES (
                        :title, :description, CAST(:configuration AS jsonb), CAST(:layout_config AS jsonb),
                        :owner_user_id, :owner_group_id, :is_public, CAST(:tags AS jsonb)
                    )
                    RETURNING id, status, version, created_at, updated_at
                """)
                
                result = await session.execute(query, {
                    "title": title,
                    "description": description,
                    "configuration": json.dumps(configuration or {}),
                    "layout_config": json.dumps(layout_config or {
                        "columns": 12,
                        "rowHeight": 100,
                        "compactType": "vertical"
                    }),
                    "owner_user_id": user_id,
                    "owner_group_id": owner_group_id,
                    "is_public": is_public,
                    "tags": json.dumps(tags or [])
                })
                
                row = result.fetchone()
                await session.commit()
                
                logger.info(f"Created dashboard {row.id} for user {user_id}")
                
                return {
                    "id": str(row.id),
                    "title": title,
                    "description": description,
                    "status": row.status,
                    "version": row.version,
                    "owner_user_id": user_id,
                    "is_public": is_public,
                    "created_at": row.created_at.isoformat(),
                    "updated_at": row.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"Failed to create dashboard: {str(e)}")
            raise
    
    async def update_dashboard(
        self,
        dashboard_id: str,
        user_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        configuration: Optional[Dict[str, Any]] = None,
        layout_config: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        is_public: Optional[bool] = None,
        is_anonymous_public: Optional[bool] = None,
        is_favorite: Optional[bool] = None
    ) -> bool:
        """Update dashboard (requires edit permission)"""
        try:
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                logger.warning(f"User {user_id} lacks edit permission for dashboard {dashboard_id}")
                return False
            
            # Build dynamic UPDATE query
            updates = []
            params = {"dashboard_id": dashboard_id}
            
            if title is not None:
                updates.append("title = :title")
                params["title"] = title
            
            if description is not None:
                updates.append("description = :description")
                params["description"] = description
            
            if configuration is not None:
                updates.append("configuration = CAST(:configuration AS jsonb)")
                params["configuration"] = json.dumps(configuration)
            
            if layout_config is not None:
                updates.append("layout_config = CAST(:layout_config AS jsonb)")
                params["layout_config"] = json.dumps(layout_config)
            
            if tags is not None:
                updates.append("tags = CAST(:tags AS jsonb)")
                params["tags"] = json.dumps(tags)
            
            if is_public is not None:
                updates.append("is_public = :is_public")
                params["is_public"] = is_public
            
            if is_anonymous_public is not None:
                updates.append("is_anonymous_public = :is_anonymous_public")
                params["is_anonymous_public"] = is_anonymous_public
            
            if is_favorite is not None:
                updates.append("is_favorite = :is_favorite")
                params["is_favorite"] = is_favorite
            
            if not updates:
                return True  # Nothing to update
            
            async with db_manager.get_session() as session:
                query = text(f"""
                    UPDATE nexus.dashboards 
                    SET {', '.join(updates)}
                    WHERE id = :dashboard_id
                """)
                
                await session.execute(query, params)
                await session.commit()
                
                logger.info(f"Updated dashboard {dashboard_id} by user {user_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update dashboard {dashboard_id}: {str(e)}")
            raise
    
    async def delete_dashboard(
        self,
        dashboard_id: str,
        user_id: str
    ) -> bool:
        """Delete dashboard (requires delete permission)"""
        try:
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "delete")
            if not has_permission:
                logger.warning(f"User {user_id} lacks delete permission for dashboard {dashboard_id}")
                return False
            
            async with db_manager.get_session() as session:
                # Cascade delete will handle tiles and permissions
                query = text("DELETE FROM nexus.dashboards WHERE id = :dashboard_id")
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                await session.commit()
                
                if result.rowcount > 0:
                    logger.info(f"Deleted dashboard {dashboard_id} by user {user_id}")
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete dashboard {dashboard_id}: {str(e)}")
            raise
    
    # =========================================================================
    # TILE CRUD
    # =========================================================================
    
    async def get_dashboard_tiles(
        self,
        dashboard_id: str,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all tiles for a dashboard (requires view permission)"""
        try:
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "view")
            if not has_permission:
                return []
            
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        dt.*,
                        u.username as created_by_username
                    FROM nexus.dashboard_tiles dt
                    LEFT JOIN nexus.users u ON dt.created_by = u.id
                    WHERE dt.dashboard_id = :dashboard_id
                    ORDER BY dt.position_y, dt.position_x
                """)
                
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                
                tiles = []
                for row in result:
                    tiles.append({
                        "id": str(row.id),
                        "dashboard_id": str(row.dashboard_id),
                        "title": row.title,
                        "description": row.description,
                        "sql_query": row.sql_query,
                        "natural_language_query": row.natural_language_query,
                        "chart_type": row.chart_type,
                        "chart_config": row.chart_config,
                        "position": {
                            "x": row.position_x,
                            "y": row.position_y,
                            "width": row.width,
                            "height": row.height
                        },
                        "refresh_interval_seconds": row.refresh_interval_seconds,
                        "last_refreshed_at": row.last_refreshed_at.isoformat() if row.last_refreshed_at else None,
                        "created_by": str(row.created_by) if row.created_by else None,
                        "created_by_username": row.created_by_username,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat() if row.updated_at else None
                    })
                
                return tiles
                
        except Exception as e:
            logger.error(f"Failed to get tiles for dashboard {dashboard_id}: {str(e)}")
            raise
    
    async def create_tile(
        self,
        dashboard_id: str,
        user_id: str,
        title: str,
        sql_query: str,
        chart_type: str,
        position_x: int = 0,
        position_y: int = 0,
        width: int = 6,
        height: int = 4,
        description: Optional[str] = None,
        natural_language_query: Optional[str] = None,
        chart_config: Optional[Dict[str, Any]] = None,
        refresh_interval_seconds: Optional[int] = None
    ) -> Dict[str, Any]:
        """Create new tile (requires edit permission on dashboard)"""
        try:
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                raise PermissionError(f"User {user_id} lacks edit permission for dashboard {dashboard_id}")
            
            async with db_manager.get_session() as session:
                query = text("""
                    INSERT INTO nexus.dashboard_tiles (
                        dashboard_id, title, description, sql_query, natural_language_query,
                        chart_type, chart_config, position_x, position_y, width, height,
                        refresh_interval_seconds, created_by
                    )
                    VALUES (
                        :dashboard_id, :title, :description, :sql_query, :nl_query,
                        :chart_type, CAST(:chart_config AS jsonb), :position_x, :position_y, :width, :height,
                        :refresh_interval, :created_by
                    )
                    RETURNING id, created_at, updated_at
                """)
                
                result = await session.execute(query, {
                    "dashboard_id": dashboard_id,
                    "title": title,
                    "description": description,
                    "sql_query": sql_query,
                    "nl_query": natural_language_query,
                    "chart_type": chart_type,
                    "chart_config": json.dumps(chart_config or {}),
                    "position_x": position_x,
                    "position_y": position_y,
                    "width": width,
                    "height": height,
                    "refresh_interval": refresh_interval_seconds,
                    "created_by": user_id
                })
                
                row = result.fetchone()
                await session.commit()
                
                logger.info(f"Created tile {row.id} in dashboard {dashboard_id}")
                
                return {
                    "id": str(row.id),
                    "dashboard_id": dashboard_id,
                    "title": title,
                    "chart_type": chart_type,
                    "created_at": row.created_at.isoformat(),
                    "updated_at": row.updated_at.isoformat()
                }
                
        except Exception as e:
            logger.error(f"Failed to create tile: {str(e)}")
            raise
    
    async def update_tile(
        self,
        tile_id: str,
        user_id: str,
        **kwargs
    ) -> bool:
        """Update tile (requires edit permission on dashboard)"""
        try:
            # Get dashboard_id first
            async with db_manager.get_session() as session:
                result = await session.execute(
                    text("SELECT dashboard_id FROM nexus.dashboard_tiles WHERE id = :tile_id"),
                    {"tile_id": tile_id}
                )
                row = result.fetchone()
                if not row:
                    return False
                
                dashboard_id = str(row.dashboard_id)
            
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                return False
            
            # Build dynamic UPDATE
            updates = []
            params = {"tile_id": tile_id}
            
            for key, value in kwargs.items():
                if value is not None:
                    if key == "chart_config":
                        updates.append(f"{key} = CAST(:{key} AS jsonb)")
                        params[key] = json.dumps(value)
                    else:
                        updates.append(f"{key} = :{key}")
                        params[key] = value
            
            if not updates:
                return True
            
            async with db_manager.get_session() as session:
                query = text(f"""
                    UPDATE nexus.dashboard_tiles 
                    SET {', '.join(updates)}
                    WHERE id = :tile_id
                """)
                
                await session.execute(query, params)
                await session.commit()
                
                logger.info(f"Updated tile {tile_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to update tile {tile_id}: {str(e)}")
            raise
    
    async def delete_tile(
        self,
        tile_id: str,
        user_id: str
    ) -> bool:
        """Delete tile (requires edit permission on dashboard)"""
        try:
            # Get dashboard_id first
            async with db_manager.get_session() as session:
                result = await session.execute(
                    text("SELECT dashboard_id FROM nexus.dashboard_tiles WHERE id = :tile_id"),
                    {"tile_id": tile_id}
                )
                row = result.fetchone()
                if not row:
                    return False
                
                dashboard_id = str(row.dashboard_id)
            
            # Check permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                return False
            
            async with db_manager.get_session() as session:
                query = text("DELETE FROM nexus.dashboard_tiles WHERE id = :tile_id")
                result = await session.execute(query, {"tile_id": tile_id})
                await session.commit()
                
                if result.rowcount > 0:
                    logger.info(f"Deleted tile {tile_id}")
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete tile {tile_id}: {str(e)}")
            raise
    
    # =========================================================================
    # PERMISSIONS & SHARING
    # =========================================================================
    
    async def check_permission(
        self,
        user_id: str,
        dashboard_id: str,
        permission: str  # 'view', 'edit', 'delete', 'share'
    ) -> bool:
        """Check if user has specific permission on dashboard"""
        try:
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT nexus.user_has_dashboard_permission(
                        CAST(:user_id AS uuid), 
                        CAST(:dashboard_id AS uuid), 
                        :permission
                    ) as has_permission
                """)
                
                result = await session.execute(query, {
                    "user_id": user_id,
                    "dashboard_id": dashboard_id,
                    "permission": permission
                })
                
                row = result.fetchone()
                # asyncpg returns tuple, access first element
                return row[0] if row else False
                
        except Exception as e:
            logger.error(f"Failed to check permission: {str(e)}")
            return False
    
    async def _get_user_permissions(
        self,
        user_id: str,
        dashboard_id: str
    ) -> Dict[str, bool]:
        """Get all permissions for user on dashboard"""
        return {
            "can_view": await self.check_permission(user_id, dashboard_id, "view"),
            "can_edit": await self.check_permission(user_id, dashboard_id, "edit"),
            "can_delete": await self.check_permission(user_id, dashboard_id, "delete"),
            "can_share": await self.check_permission(user_id, dashboard_id, "share")
        }
    
    async def grant_permission(
        self,
        dashboard_id: str,
        granter_user_id: str,
        target_user_id: Optional[str] = None,
        target_group_id: Optional[str] = None,
        can_view: bool = True,
        can_edit: bool = False,
        can_delete: bool = False,
        can_share: bool = False,
        expires_at: Optional[datetime] = None
    ) -> bool:
        """
        Grant permissions to user or group (requires share permission)
        """
        try:
            # Check if granter has share permission
            has_share_permission = await self.check_permission(granter_user_id, dashboard_id, "share")
            if not has_share_permission:
                logger.warning(f"User {granter_user_id} lacks share permission for dashboard {dashboard_id}")
                return False
            
            if not target_user_id and not target_group_id:
                raise ValueError("Must specify either target_user_id or target_group_id")
            
            async with db_manager.get_session() as session:
                # Separate queries for user vs group to avoid multiple commands
                if target_user_id:
                    # Grant to user
                    query = text("""
                        INSERT INTO nexus.dashboard_permissions (
                            dashboard_id, user_id, group_id, 
                            can_view, can_edit, can_delete, can_share,
                            granted_by, expires_at
                        )
                        VALUES (
                            :dashboard_id, :user_id, NULL,
                            :can_view, :can_edit, :can_delete, :can_share,
                            :granted_by, :expires_at
                        )
                        ON CONFLICT (dashboard_id, user_id) 
                        DO UPDATE SET
                            can_view = EXCLUDED.can_view,
                            can_edit = EXCLUDED.can_edit,
                            can_delete = EXCLUDED.can_delete,
                            can_share = EXCLUDED.can_share,
                            expires_at = EXCLUDED.expires_at,
                            granted_at = CURRENT_TIMESTAMP
                    """)
                    
                    await session.execute(query, {
                        "dashboard_id": dashboard_id,
                        "user_id": target_user_id,
                        "can_view": can_view,
                        "can_edit": can_edit,
                        "can_delete": can_delete,
                        "can_share": can_share,
                        "granted_by": granter_user_id,
                        "expires_at": expires_at
                    })
                else:
                    # Grant to group
                    query = text("""
                        INSERT INTO nexus.dashboard_permissions (
                            dashboard_id, user_id, group_id, 
                            can_view, can_edit, can_delete, can_share,
                            granted_by, expires_at
                        )
                        VALUES (
                            :dashboard_id, NULL, :group_id,
                            :can_view, :can_edit, :can_delete, :can_share,
                            :granted_by, :expires_at
                        )
                        ON CONFLICT (dashboard_id, group_id) 
                        DO UPDATE SET
                            can_view = EXCLUDED.can_view,
                            can_edit = EXCLUDED.can_edit,
                            can_delete = EXCLUDED.can_delete,
                            can_share = EXCLUDED.can_share,
                            expires_at = EXCLUDED.expires_at,
                            granted_at = CURRENT_TIMESTAMP
                    """)
                    
                    await session.execute(query, {
                        "dashboard_id": dashboard_id,
                        "group_id": target_group_id,
                        "can_view": can_view,
                        "can_edit": can_edit,
                        "can_delete": can_delete,
                        "can_share": can_share,
                        "granted_by": granter_user_id,
                        "expires_at": expires_at
                    })
                
                await session.commit()
                
                logger.info(f"Granted permissions on dashboard {dashboard_id} to user={target_user_id} group={target_group_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to grant permission: {str(e)}")
            raise
    
    async def revoke_permission(
        self,
        dashboard_id: str,
        revoker_user_id: str,
        target_user_id: Optional[str] = None,
        target_group_id: Optional[str] = None
    ) -> bool:
        """Revoke permissions from user or group (requires share permission)"""
        try:
            # Check if revoker has share permission
            has_share_permission = await self.check_permission(revoker_user_id, dashboard_id, "share")
            if not has_share_permission:
                return False
            
            async with db_manager.get_session() as session:
                if target_user_id:
                    query = text("""
                        DELETE FROM nexus.dashboard_permissions
                        WHERE dashboard_id = :dashboard_id AND user_id = :user_id
                    """)
                    await session.execute(query, {"dashboard_id": dashboard_id, "user_id": target_user_id})
                elif target_group_id:
                    query = text("""
                        DELETE FROM nexus.dashboard_permissions
                        WHERE dashboard_id = :dashboard_id AND group_id = :group_id
                    """)
                    await session.execute(query, {"dashboard_id": dashboard_id, "group_id": target_group_id})
                else:
                    return False
                
                await session.commit()
                logger.info(f"Revoked permissions on dashboard {dashboard_id}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to revoke permission: {str(e)}")
            raise
    
    # =========================================================================
    # DASHBOARD VERSIONING & PUBLISHING
    # =========================================================================
    
    async def publish_dashboard(
        self,
        dashboard_id: str,
        user_id: str,
        version_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Publish dashboard - creates version snapshot and changes status to published"""
        try:
            # Check if user has edit permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                return {"success": False, "error": "Permission denied"}
            
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT nexus.publish_dashboard(
                        CAST(:dashboard_id AS uuid),
                        CAST(:user_id AS uuid),
                        :version_notes
                    )
                """)
                
                result = await session.execute(query, {
                    "dashboard_id": dashboard_id,
                    "user_id": user_id,
                    "version_notes": version_notes
                })
                
                await session.commit()
                
                row = result.fetchone()
                result_json = row[0] if row else {}
                
                return {
                    "success": True,
                    "dashboard_id": str(result_json.get("dashboard_id")),
                    "version": result_json.get("version"),
                    "status": result_json.get("status"),
                    "published_at": result_json.get("published_at"),
                    "published_by": str(result_json.get("published_by"))
                }
                
        except Exception as e:
            logger.error(f"Failed to publish dashboard: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def get_dashboard_versions(
        self,
        dashboard_id: str,
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get version history for a dashboard"""
        try:
            # Check if user has view permission
            has_permission = await self.check_permission(user_id, dashboard_id, "view")
            if not has_permission:
                return []
            
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT 
                        id,
                        version,
                        title,
                        description,
                        created_by,
                        created_at,
                        version_notes,
                        change_summary,
                        jsonb_array_length(tiles_snapshot) as tiles_count
                    FROM nexus.dashboard_versions
                    WHERE dashboard_id = :dashboard_id
                    ORDER BY version DESC
                """)
                
                result = await session.execute(query, {"dashboard_id": dashboard_id})
                
                versions = []
                for row in result:
                    versions.append({
                        "id": str(row.id),
                        "version": row.version,
                        "title": row.title,
                        "description": row.description,
                        "created_by": str(row.created_by),
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "version_notes": row.version_notes,
                        "change_summary": row.change_summary,
                        "tiles_count": row.tiles_count
                    })
                
                return versions
                
        except Exception as e:
            logger.error(f"Failed to get dashboard versions: {str(e)}")
            return []
    
    async def revert_dashboard_version(
        self,
        dashboard_id: str,
        target_version: int,
        user_id: str
    ) -> Dict[str, Any]:
        """Revert dashboard to a previous version"""
        try:
            # Check if user has edit permission
            has_permission = await self.check_permission(user_id, dashboard_id, "edit")
            if not has_permission:
                return {"success": False, "error": "Permission denied"}
            
            async with db_manager.get_session() as session:
                query = text("""
                    SELECT nexus.revert_dashboard_version(
                        CAST(:dashboard_id AS uuid),
                        CAST(:target_version AS integer),
                        CAST(:user_id AS uuid)
                    )
                """)
                
                result = await session.execute(query, {
                    "dashboard_id": dashboard_id,
                    "target_version": target_version,
                    "user_id": user_id
                })
                
                await session.commit()
                
                row = result.fetchone()
                success = row[0] if row else False
                
                if success:
                    return {
                        "success": True,
                        "dashboard_id": dashboard_id,
                        "reverted_to_version": target_version,
                        "message": f"Dashboard reverted to version {target_version}. Status set to draft."
                    }
                else:
                    return {"success": False, "error": "Revert failed"}
                
        except Exception as e:
            logger.error(f"Failed to revert dashboard version: {str(e)}")
            return {"success": False, "error": str(e)}


# Singleton instance
dashboard_service = DashboardService()

