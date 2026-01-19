import { useState } from 'react';
import { X, Mail } from 'lucide-react';
import type { EnvelopeAddress } from '../../types';
import { ENVELOPE_SIZES } from '../../types';

interface Props {
  onClose: () => void;
  onApply: (address: EnvelopeAddress, size: { width: number; height: number }) => void;
  initialAddress?: EnvelopeAddress;
}

export function EnvelopeDialog({ onClose, onApply, initialAddress }: Props) {
  const [envelopeSize, setEnvelopeSize] = useState('dl');
  const [recipientName, setRecipientName] = useState(initialAddress?.recipient_name || '');
  const [recipientStreet, setRecipientStreet] = useState(initialAddress?.recipient_street || '');
  const [recipientCity, setRecipientCity] = useState(initialAddress?.recipient_city || '');
  const [recipientCountry, setRecipientCountry] = useState(initialAddress?.recipient_country || '');

  const [senderName, setSenderName] = useState(initialAddress?.sender_name || '');
  const [senderStreet, setSenderStreet] = useState(initialAddress?.sender_street || '');
  const [senderCity, setSenderCity] = useState(initialAddress?.sender_city || '');
  const [senderCountry, setSenderCountry] = useState(initialAddress?.sender_country || '');

  const handleApply = () => {
    const address: EnvelopeAddress = {
      recipient_name: recipientName,
      recipient_street: recipientStreet,
      recipient_city: recipientCity,
      recipient_country: recipientCountry,
      sender_name: senderName,
      sender_street: senderStreet,
      sender_city: senderCity,
      sender_country: senderCountry,
    };

    const size = ENVELOPE_SIZES[envelopeSize as keyof typeof ENVELOPE_SIZES];
    onApply(address, { width: size.width, height: size.height });
    onClose();
  };

  const isValid = recipientName.trim() && recipientCity.trim();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header flex justify-between items-center">
          <h2 className="dialog-title">
            <Mail size={20} style={{ marginRight: 8, display: 'inline' }} />
            Envelope Addressing
          </h2>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dialog-content">
          {/* Envelope Size */}
          <div className="form-group">
            <label className="form-label">Envelope Size</label>
            <select
              className="form-select"
              value={envelopeSize}
              onChange={(e) => setEnvelopeSize(e.target.value)}
            >
              {Object.entries(ENVELOPE_SIZES).map(([key, size]) => (
                <option key={key} value={key}>
                  {size.name} ({size.width}x{size.height}mm)
                </option>
              ))}
            </select>
          </div>

          {/* Recipient */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>Recipient</h4>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input
                className="form-input"
                value={recipientStreet}
                onChange={(e) => setRecipientStreet(e.target.value)}
                placeholder="123 Main St, Apt 4"
              />
            </div>
            <div className="form-group">
              <label className="form-label">City, State, ZIP *</label>
              <input
                className="form-input"
                value={recipientCity}
                onChange={(e) => setRecipientCity(e.target.value)}
                placeholder="New York, NY 10001"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                className="form-input"
                value={recipientCountry}
                onChange={(e) => setRecipientCountry(e.target.value)}
                placeholder="USA"
              />
            </div>
          </div>

          {/* Sender (optional) */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-primary)' }}>
              Return Address (Optional)
            </h4>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input
                className="form-input"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input
                className="form-input"
                value={senderStreet}
                onChange={(e) => setSenderStreet(e.target.value)}
                placeholder="456 Oak Ave"
              />
            </div>
            <div className="form-group">
              <label className="form-label">City, State, ZIP</label>
              <input
                className="form-input"
                value={senderCity}
                onChange={(e) => setSenderCity(e.target.value)}
                placeholder="Los Angeles, CA 90001"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                className="form-input"
                value={senderCountry}
                onChange={(e) => setSenderCountry(e.target.value)}
                placeholder="USA"
              />
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!isValid}>
            Apply Address
          </button>
        </div>
      </div>
    </div>
  );
}
