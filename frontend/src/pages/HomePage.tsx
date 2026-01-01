import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { NewProjectDialog } from '../components/dialogs/NewProjectDialog';
import type { Project } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const { projects, isLoading, loadProjects, deleteProject } = useProjectStore();
  const [showNewDialog, setShowNewDialog] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectCreated = (project: Project) => {
    setShowNewDialog(false);
    navigate(`/editor/${project.id}`);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(projectId);
    }
  };

  return (
    <div className="page">
      <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
        <h2>Projects</h2>
        <button className="btn btn-primary" onClick={() => setShowNewDialog(true)}>
          <Plus size={20} />
          New Project
        </button>
      </div>

      {isLoading ? (
        <p>Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            No projects yet. Create your first project to get started.
          </p>
          <button className="btn btn-primary" onClick={() => setShowNewDialog(true)}>
            <Plus size={20} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3" style={{ gap: 16 }}>
          {projects.map((project) => (
            <div
              key={project.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/editor/${project.id}`)}
            >
              <div className="flex justify-between items-center">
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{project.name}</h3>
                <div className="flex gap-2">
                  <button
                    className="btn btn-icon btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/editor/${project.id}`);
                    }}
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="btn btn-icon btn-secondary"
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    title="Delete"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-secondary)',
                  marginTop: 8,
                }}
              >
                {project.paper_size.toUpperCase()} ({project.width_mm}x{project.height_mm}mm)
                {project.is_double_sided && ' • Double-sided'}
                {project.include_envelope && ' • Envelope'}
              </p>
              <p
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  marginTop: 8,
                }}
              >
                Updated: {new Date(project.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}

export default HomePage;
