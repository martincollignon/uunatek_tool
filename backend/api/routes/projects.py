"""Project management API routes."""

from fastapi import APIRouter, HTTPException
from typing import Optional
from models.project import Project, ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])

# In-memory storage (replace with database for production)
_projects: dict[str, Project] = {}


@router.post("", response_model=Project)
async def create_project(data: ProjectCreate) -> Project:
    """Create a new project."""
    project = Project.from_create(data)
    _projects[project.id] = project
    return project


@router.get("", response_model=list[Project])
async def list_projects() -> list[Project]:
    """List all projects."""
    return list(_projects.values())


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    """Get a specific project."""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    return _projects[project_id]


@router.put("/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectUpdate) -> Project:
    """Update a project."""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = _projects[project_id]

    if data.name is not None:
        project.name = data.name
    if data.envelope_address is not None:
        project.envelope_address = data.envelope_address

    from datetime import datetime
    project.updated_at = datetime.utcnow()

    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    del _projects[project_id]
    return {"status": "deleted"}


def get_project_by_id(project_id: str) -> Optional[Project]:
    """Get project by ID (internal use)."""
    return _projects.get(project_id)


def save_project(project: Project):
    """Save project (internal use)."""
    _projects[project.id] = project
