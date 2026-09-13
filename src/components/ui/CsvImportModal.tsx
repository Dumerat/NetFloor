"use client";

import { useState, type FC } from "react";
import {
  X,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { NodeDisplay, RackDisplay } from "@/components/canvas/EquipmentLayer";
import {
  parseAndAuditMatrixCsv,
  applyMatrixImport,
  MatrixAuditResult,
  ApplyMatrixResult,
  MatrixRowError,
} from "@/engine/ingestion/matrixCsvParser";

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
  nodes?: NodeDisplay[] | undefined;
  racks?: RackDisplay[] | undefined;
  onApplyImport?: ((result: ApplyMatrixResult) => void) | undefined;
}

const SAMPLE_MATRIX_CSV = `Prise_ID,Bureau_ID,Utilisateur,IP_Machine,MAC,VLAN_ID,Baie,Switch_Nom,Port_Switch
outlet-408-a,desk-408,Alexandre Martin,10.42.20.108,B4:2E:99:41:0A:12,20,BAIE-PRINCIPALE-RDC,SW-ARUBA-2930F-24G,Gi1/0/1
outlet-408-b,desk-408,Alexandre Martin,10.42.30.108,00:08:5D:8A:22:9C,30,BAIE-PRINCIPALE-RDC,SW-ARUBA-2930F-24G,Gi1/0/2
PRISE-NEW-01,BUREAU-RH-101,Clara Bernard,10.42.20.115,70:85:C2:33:44:55,20,BAIE-SECONDAIRE-EST,SW-BAIE-EST-01,Gi1/0/3
PRISE-NEW-02,BUREAU-RH-101,Clara Bernard,10.42.30.115,00:08:5D:11:22:33,30,BAIE-SECONDAIRE-EST,SW-BAIE-EST-01,Gi1/0/4`;

export const CsvImportModal: FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  nodes = [],
  racks = [],
  onApplyImport,
}) => {
  const [csvContent, setCsvContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<MatrixAuditResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAudit = () => {
    if (!csvContent.trim()) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = parseAndAuditMatrixCsv(csvContent);
      setAuditResult(result);
      if (!result.isValid && result.errors.length > 0) {
        setErrorMessage(
          `${result.errors.length} anomalie(s) détectée(s) dans le carnet CSV.`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur d'analyse du CSV";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = () => {
    if (!auditResult || !auditResult.isValid) return;
    setLoading(true);

    try {
      const result = applyMatrixImport(auditResult.validRows, nodes, racks);
      onApplyImport?.(result);
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'application";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                Ingestion CSV Matricielle (Tables de Brassage DSI)
              </h3>
              <p className="text-[11px] text-slate-400">
                Prise_ID, Bureau_ID, Utilisateur, IP_Machine, MAC, VLAN_ID, Baie, Switch_Nom, Port_Switch
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="font-medium text-slate-300">Contenu CSV brut</label>
              <button
                type="button"
                onClick={() => {
                  setCsvContent(SAMPLE_MATRIX_CSV);
                  setAuditResult(null);
                  setErrorMessage(null);
                }}
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 font-mono"
              >
                <FileText className="w-3 h-3" /> Charger exemple matriciel DSI
              </button>
            </div>
            <textarea
              rows={7}
              value={csvContent}
              onChange={(e) => {
                setCsvContent(e.target.value);
                setAuditResult(null);
                setErrorMessage(null);
              }}
              placeholder="Prise_ID,Bureau_ID,Utilisateur,IP_Machine,MAC,VLAN_ID,Baie,Switch_Nom,Port_Switch&#10;outlet-01,desk-01,Jean Dupont,10.42.20.10,AA:BB:CC:DD:EE:01,20,rack-01,SW-01,Gi1/0/1"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2 font-mono text-[11px]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Résultats d'Audit */}
          {auditResult && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Bilan de Validation Matricielle :</span>
                  {auditResult.isValid ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> CSV 100% VALIDE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/30 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {auditResult.errors.length} ANOMALIES
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 font-mono text-[11px] pt-2 border-t border-slate-800/80 text-slate-400">
                  <div>
                    Lignes valides :{" "}
                    <span className="text-slate-200 font-semibold">
                      {auditResult.summary.validCount}/{auditResult.summary.totalRows}
                    </span>
                  </div>
                  <div>
                    Prises distinctes :{" "}
                    <span className="text-slate-200 font-semibold">
                      {auditResult.summary.distinctOutlets}
                    </span>
                  </div>
                  <div>
                    Bureaux associés :{" "}
                    <span className="text-slate-200 font-semibold">
                      {auditResult.summary.distinctDesks}
                    </span>
                  </div>
                  <div>
                    Utilisateurs :{" "}
                    <span className="text-slate-200 font-semibold">
                      {auditResult.summary.distinctUsers}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 pt-1">
                  Les prises ou bureaux non encore présents sur le plan seront automatiquement placés dans la zone « Éléments non positionnés » pour un glisser-déposer sur le canevas.
                </p>
              </div>

              {/* Erreurs de format éventuelles */}
              {auditResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                  {auditResult.errors.map((err: MatrixRowError, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-red-500/5 border border-red-500/20 text-red-400 flex items-start justify-between"
                    >
                      <div>
                        <span className="font-bold">[Ligne {err.row}]</span> Colonne{" "}
                        <span className="text-red-300 font-semibold">{err.column}</span> :{" "}
                        {err.message}
                      </div>
                      {err.value && (
                        <span className="px-1.5 py-0.5 rounded bg-red-950/40 text-[10px] text-red-300 ml-2">
                          {err.value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end gap-2.5 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-medium transition"
          >
            Fermer
          </button>

          {!auditResult?.isValid ? (
            <button
              type="button"
              disabled={loading || !csvContent.trim()}
              onClick={handleAudit}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5"
            >
              {loading ? "Audit en cours..." : "Lancer Validation Matricielle"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleCommit}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mettre à Jour les Équipements & Prises</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
