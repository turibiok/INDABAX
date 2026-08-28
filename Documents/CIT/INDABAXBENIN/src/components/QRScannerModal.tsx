import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Camera, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  RefreshCw, 
  FileSpreadsheet, 
  UserCheck, 
  Zap, 
  Volume2,
  Users
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Session, Participant } from '../types';
import { useEvent } from '../context/EventContext';

export const QRScannerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  targetSession?: Session | null;
}> = ({ isOpen, onClose, targetSession }) => {
  const {
    sessions,
    participants,
    checkInParticipant,
    isSheetsLinked,
    canWriteToSheets,
  } = useEvent();

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    targetSession?.id || (sessions[0]?.id ?? '')
  );

  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    participant?: Participant;
  } | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [manualTicketInput, setManualTicketInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<{ name: string; time: string; role: string; success: boolean }[]>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "reader-indabax-qr";

  useEffect(() => {
    if (targetSession) {
      setSelectedSessionId(targetSession.id);
    }
  }, [targetSession]);

  // Start / Stop camera scanner when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      setScanResult(null);
      setCameraError(null);
      // Small timeout to allow DOM node to render
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  const startScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await stopScanner();
      }

      const element = document.getElementById(scannerContainerId);
      if (!element) return;

      const html5QrCode = new Html5Qrcode(scannerContainerId);
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScannedData(decodedText);
        },
        (errorMessage) => {
          // Ignore parse errors while camera is focusing
        }
      );
      setIsScanning(true);
      setCameraError(null);
    } catch (err: any) {
      console.warn("Camera start failed, falling back to manual/upload mode", err);
      setCameraError("Caméra non accessible ou permissions refusées. Utilisez le mode saisie manuelle ou le simulateur de scan rapide.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner", e);
      }
      html5QrCodeRef.current = null;
      setIsScanning(false);
    }
  };

  const handleScannedData = async (data: string) => {
    if (!selectedSessionId) {
      alert("Veuillez sélectionner une session d'émargement.");
      return;
    }

    const res = await checkInParticipant(data, selectedSessionId, "Scanner IndabaX");
    setScanResult(res);

    if (res.participant) {
      setRecentScans(prev => [
        {
          name: res.participant!.name,
          time: new Date().toLocaleTimeString(),
          role: res.participant!.role,
          success: res.success
        },
        ...prev.slice(0, 4)
      ]);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTicketInput.trim()) return;
    handleScannedData(manualTicketInput.trim());
    setManualTicketInput('');
  };

  // Image file scan fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }
      const result = await html5QrCodeRef.current.scanFile(file, true);
      handleScannedData(result);
    } catch (err: any) {
      alert("Impossible de lire un QR code dans cette image. Assurez-vous que l'image est nette.");
    }
  };

  if (!isOpen) return null;

  const currentSessionObj = sessions.find(s => s.id === selectedSessionId);

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-stone-200 rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl animate-in zoom-in-95 my-auto text-stone-800">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-800">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-black text-lg text-stone-900">
                Scanner & Émargement Express
              </h2>
              <p className="text-xs text-stone-500">
                Validation instantanée des présences aux sessions IndabaX
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session Selector */}
        <div className="mb-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
            Session active pour l'émargement :
          </label>
          <select
            id="select-scanner-session"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                Jour {s.day} [{s.startTime}] - {s.title} ({s.room})
              </option>
            ))}
          </select>
          {currentSessionObj && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500 px-1">
              <span>Salle : <strong className="text-stone-800">{currentSessionObj.room}</strong></span>
              <span>Présences : <strong className="text-emerald-700">{currentSessionObj.currentAttendees}</strong> inscrits</span>
            </div>
          )}
        </div>

        {/* Scan Result Feedback Banner */}
        {scanResult && (
          <div className={`p-4 rounded-2xl mb-4 border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
            scanResult.success
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            {scanResult.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1 flex-1">
              <p className="font-bold text-sm">{scanResult.message}</p>
              {scanResult.participant && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="bg-white border border-stone-200 px-2 py-0.5 rounded text-[11px] font-mono text-amber-800 font-bold">
                    {scanResult.participant.ticketNumber}
                  </span>
                  <span className="text-[11px] text-stone-600 font-medium">
                    {scanResult.participant.institution}
                  </span>
                  {isSheetsLinked && canWriteToSheets && (
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                      <FileSpreadsheet className="w-3 h-3" /> Écrit dans le classeur
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Camera Scanner Viewport */}
        <div className="relative bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden p-2 text-center">
          <div 
            id={scannerContainerId} 
            className="w-full h-56 rounded-xl overflow-hidden bg-black flex items-center justify-center"
          >
            {cameraError && (
              <div className="p-4 text-xs text-stone-300">
                <Camera className="w-8 h-8 mx-auto mb-2 text-stone-500" />
                <p className="text-amber-300 font-semibold mb-1">{cameraError}</p>
                <p className="text-stone-400">Utilisez les boutons de test rapide ci-dessous pour valider immédiatement des scans.</p>
              </div>
            )}
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={() => startScanner()}
              className="p-2 bg-stone-800/90 hover:bg-stone-700 text-stone-200 rounded-xl backdrop-blur text-xs cursor-pointer"
              title="Redémarrer la caméra"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Simulation / Test Attendees */}
        <div className="mt-4 pt-3 border-t border-stone-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-2 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            Simulateur de Scan Rapide (1-Clic pour tester) :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {participants.slice(0, 6).map((p) => (
              <button
                key={p.id}
                onClick={() => handleScannedData(p.ticketNumber)}
                className="flex items-center gap-2 p-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-left transition cursor-pointer"
              >
                <img src={p.avatarUrl} alt={p.name} className="w-6 h-6 rounded-lg object-cover" />
                <div className="truncate flex-1">
                  <p className="text-[11px] font-bold text-stone-900 truncate">{p.name.split(' ')[0]}</p>
                  <p className="text-[9px] text-amber-700 uppercase font-mono font-bold">{p.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Input or File Upload Fallback */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleManualSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Ex: INDABAX-BJ-2026-001 ou email"
              value={manualTicketInput}
              onChange={(e) => setManualTicketInput(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-stone-950 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Valider
            </button>
          </form>

          <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-xl text-xs font-medium cursor-pointer transition">
            <Upload className="w-3.5 h-3.5 text-stone-500" />
            <span>Image QR</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Recent Scans Strip */}
        {recentScans.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-100">
            <p className="text-[11px] text-stone-500 font-bold uppercase mb-1.5">Historique de la session :</p>
            <div className="space-y-1">
              {recentScans.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 bg-stone-50 rounded-lg text-stone-700">
                  <span className="font-semibold text-stone-900">{s.name} ({s.role})</span>
                  <span className="text-[11px] text-stone-500 font-mono">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
