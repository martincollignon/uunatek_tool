import { useState } from 'react';
import { X } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { PAPER_DIMENSIONS, ENVELOPE_DIMENSIONS } from '../../types';
import type { PaperSize, EnvelopeSize, ProjectCreate, Project } from '../../types';

interface Props {
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function NewProjectDialog({ onClose, onCreated }: Props) {
  const { createProject, isLoading } = useProjectStore();

  const [name, setName] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('a4');
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [isDoubleSided, setIsDoubleSided] = useState(false);
  const [includeEnvelope, setIncludeEnvelope] = useState(false);
  const [envelopeSize, setEnvelopeSize] = useState<EnvelopeSize>('dl');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: ProjectCreate = {
      name,
      paper_size: paperSize,
      is_double_sided: isDoubleSided,
      include_envelope: includeEnvelope,
    };

    if (paperSize === 'custom') {
      data.custom_width_mm = customWidth;
      data.custom_height_mm = customHeight;
    }

    if (includeEnvelope) {
      data.envelope_address = {
        recipient_name: '',
        recipient_city: '',
      };
    }

    try {
      const project = await createProject(data);
      onCreated(project);
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">New Project</h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-content">
            <div className="form-group">
              <label className="form-label">Project Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Print"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Paper Size</label>
              <select
                className="form-select"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              >
                {Object.entries(PAPER_DIMENSIONS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {paperSize === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Width (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    min={10}
                    max={500}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Height (mm)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    min={10}
                    max={500}
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="flex items-center gap-2" style={{ cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                <input
                  type="checkbox"
                  checked={isDoubleSided}
                  onChange={(e) => setIsDoubleSided(e.target.checked)}
                />
                Double-sided (print on both sides)
              </label>
            </div>

            <div className="form-group">
              <label className="flex items-center gap-2" style={{ cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                <input
                  type="checkbox"
                  checked={includeEnvelope}
                  onChange={(e) => setIncludeEnvelope(e.target.checked)}
                />
                Include envelope addressing
              </label>
            </div>

            {includeEnvelope && (
              <div className="form-group">
                <label className="form-label">Envelope Size</label>
                <select
                  className="form-select"
                  value={envelopeSize}
                  onChange={(e) => setEnvelopeSize(e.target.value as EnvelopeSize)}
                >
                  {Object.entries(ENVELOPE_DIMENSIONS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="dialog-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
