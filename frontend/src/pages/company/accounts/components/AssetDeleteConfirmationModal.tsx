import React from 'react'
import type { DetailedAsset } from '../../../../services/assets'
import EnterpriseModal from '../../../../components/ui/EnterpriseModal'
import EnterpriseButton from '../../../../components/ui/EnterpriseButton'
import { Trash2, AlertTriangle, ShieldAlert, Archive, Loader2 } from 'lucide-react'

interface AssetDeleteConfirmationModalProps {
  isOpen: boolean
  asset: DetailedAsset
  deleteBlocked: boolean
  blockedReason?: string
  checkingHistory?: boolean
  pending: boolean
  canManage: boolean
  onClose: () => void
  onConfirmDelete: () => void
  onMarkDisposed: () => void
}

export const AssetDeleteConfirmationModal: React.FC<AssetDeleteConfirmationModalProps> = ({
  isOpen,
  asset,
  deleteBlocked,
  blockedReason,
  checkingHistory = false,
  pending,
  canManage,
  onClose,
  onConfirmDelete,
  onMarkDisposed
}) => {
  const isHistorical = ['disposed', 'retired'].includes(asset.currentStatus.toLowerCase()) || Boolean(asset.disposalDate)

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="sm"
      title={
        <div className="flex items-center gap-2">
          {checkingHistory ? (
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : deleteBlocked ? (
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Trash2 className="w-4 h-4" />
            </div>
          )}
          <span className="text-sm font-extrabold text-slate-900">
            {checkingHistory
              ? 'Evaluating Asset Safety'
              : deleteBlocked
              ? 'Cannot Permanently Delete'
              : 'Delete Asset Record'}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <EnterpriseButton
            type="button"
            disabled={pending}
            onClick={onClose}
            variant="secondary"
            size="sm"
          >
            {deleteBlocked && isHistorical ? 'Close' : 'Cancel'}
          </EnterpriseButton>

          {checkingHistory ? (
            <EnterpriseButton
              type="button"
              disabled
              variant="secondary"
              size="sm"
            >
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              Checking History...
            </EnterpriseButton>
          ) : deleteBlocked ? (
            !isHistorical && (
              <EnterpriseButton
                type="button"
                disabled={!canManage || pending}
                onClick={onMarkDisposed}
                variant="primary"
                size="sm"
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                Mark as Disposed
              </EnterpriseButton>
            )
          ) : (
            <EnterpriseButton
              type="button"
              loading={pending}
              loadingText="Deleting..."
              onClick={onConfirmDelete}
              variant="danger"
              size="sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete Permanently
            </EnterpriseButton>
          )}
        </div>
      }
    >
      <div className="space-y-3.5 text-xs text-slate-700 select-none">
        {/* ASSET BADGE CARD */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
          <span className="font-extrabold text-slate-900 text-sm block">{asset.assetName}</span>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
            <span className="font-mono text-[#1A56DB]">{asset.assetTag || asset.assetCode}</span>
            <span>·</span>
            <span>{asset.assetCategory}</span>
            <span>·</span>
            <span className={`font-semibold ${isHistorical ? 'text-amber-700' : 'text-emerald-700'}`}>
              {asset.currentStatus}
            </span>
            <span>·</span>
            <span>{asset.location || 'Main Site'}</span>
          </div>
        </div>

        {/* LOADING STATE */}
        {checkingHistory ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-3 text-slate-600">
            <Loader2 className="w-5 h-5 text-[#1A56DB] animate-spin shrink-0" />
            <span className="text-xs font-medium">Checking dependencies and financial audit trail...</span>
          </div>
        ) : deleteBlocked ? (
          /* BLOCKED HISTORICAL REASON */
          <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-900 space-y-1.5">
            <strong className="font-bold text-xs block text-amber-950 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              {isHistorical ? 'Asset is Already Disposed' : 'Audit Trail & Historical Records Detected'}
            </strong>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {blockedReason ||
                (isHistorical
                  ? 'This asset has already been disposed and is archived in your accounting records. Disposed assets must remain permanently in the ledger for compliance and tax audits.'
                  : 'This asset contains historical financial records, depreciation ledger entries, or maintenance logs and cannot be safely deleted without compromising accounting integrity.')}
            </p>
            {!isHistorical && (
              <p className="text-[11px] text-amber-900 font-semibold pt-1">
                You can mark this asset as <strong>Disposed</strong> instead to retire it from active operations while
                safely preserving accounting history.
              </p>
            )}
          </div>
        ) : (
          /* SAFE TO DELETE PERMANENTLY */
          <div className="space-y-2 text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800">
              This permanently removes this asset record from your database.
            </p>
            <p className="text-[11px]">
              Use this action <strong>only</strong> when the asset was created accidentally or is an incorrect/duplicate record.
            </p>
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
              Real assets that are no longer in active service should be marked as <strong>Disposed</strong> so their
              capitalization and depreciation history remain available for financial auditing.
            </p>
          </div>
        )}
      </div>
    </EnterpriseModal>
  )
}

export default AssetDeleteConfirmationModal
