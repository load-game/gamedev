import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'

import { AvatarPreview } from '../AvatarPreview'
import { getAvatarRankLabel, getAvatarRankSpec } from '../../core/extras/avatarRank'

const METRIC_CONFIGS = [
  {
    key: 'fileSize',
    label: 'File Size',
    format: value => (Number.isFinite(value) ? `${(value / 1048576).toFixed(1)} MB` : '-'),
  },
  {
    key: 'triangles',
    label: 'Triangles',
    format: value => (Number.isFinite(value) ? Math.round(value).toLocaleString() : '-'),
  },
  {
    key: 'draws',
    label: 'Draw Calls',
    format: value => (Number.isFinite(value) ? Math.round(value).toLocaleString() : '-'),
  },
  {
    key: 'bones',
    label: 'Bones',
    format: value => (Number.isFinite(value) ? Math.round(value).toLocaleString() : '-'),
  },
  {
    key: 'bounds',
    label: 'Bounds',
    format: value => {
      if (!Array.isArray(value) || value.length !== 3) return '-'
      return `[${value.map(axis => (Number.isFinite(axis) ? axis.toFixed(1) : '?')).join(', ')}]`
    },
  },
]

export function AvatarPane({ world, info }) {
  const viewportRef = useRef()
  const [previewInfo, setPreviewInfo] = useState(null)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    const viewport = viewportRef.current
    const preview = new AvatarPreview(world, viewport)
    preview
      .load(info.file, info.url)
      .then(result => {
        setPreviewInfo(result)
      })
      .catch(err => {
        console.error(err)
        setPreviewInfo({ error: 'Failed to load avatar' })
      })
    return () => preview.destroy()
  }, [])
  const canEquip = Number.isFinite(previewInfo?.rank)
  let rankText = 'Analyzing...'
  if (canEquip) {
    rankText = `Rank ${previewInfo.rank} (${getAvatarRankLabel(previewInfo.rank)})`
  } else if (previewInfo?.error) {
    rankText = previewInfo.error
  }
  const metricRows = canEquip
    ? METRIC_CONFIGS.map(config => {
        const stat = previewInfo.stats?.[config.key]
        const valueText = config.format(stat?.value)
        const metricRank = Number.isFinite(stat?.rank) ? stat.rank : 1
        return {
          key: config.key,
          label: config.label,
          valueText,
          metricRank,
        }
      })
    : []
  const nextRank = canEquip && previewInfo.rank < 5 ? previewInfo.rank + 1 : null
  const nextRankSpec = nextRank ? getAvatarRankSpec(nextRank) : null
  return (
    <div
      className='vpane'
      css={css`
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16rem;
        background: rgba(11, 10, 21, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 1.375rem;
        backdrop-filter: blur(5px);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        overflow: hidden;
        .vpane-head {
          height: 3.125rem;
          display: flex;
          align-items: center;
          padding: 0 0.3rem 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          &-title {
            font-size: 1rem;
            font-weight: 500;
            flex: 1;
          }
          &-close {
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #5d6077;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .vpane-content {
          flex: 1;
          position: relative;
        }
        .vpane-viewport {
          height: 17rem;
          position: relative;
        }
        .vpane-viewport-inner {
          position: absolute;
          inset: 0;
        }
        .vpane-rank {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.45rem 0.75rem;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
        }
        .vpane-details {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .vpane-details-toggle {
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.75);
          &:hover {
            cursor: pointer;
            color: white;
            background: rgba(255, 255, 255, 0.03);
          }
        }
        .vpane-details-body {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.55rem 0.75rem 0.65rem 0.75rem;
          font-size: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .vpane-details-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 0.15rem;
          padding: 0.1rem 0;
        }
        .vpane-details-left {
          display: flex;
          gap: 0.35rem;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .vpane-details-label {
          color: rgba(255, 255, 255, 0.88);
        }
        .vpane-details-value {
          color: rgba(255, 255, 255, 0.65);
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .vpane-details-right {
          display: flex;
          align-items: baseline;
          gap: 0.35rem;
          white-space: normal;
          flex-wrap: wrap;
          justify-content: flex-start;
        }
        .vpane-details-rank {
          color: rgba(255, 255, 255, 0.95);
        }
        .vpane-details-target {
          color: rgba(255, 255, 255, 0.55);
        }
        .vpane-actions {
          display: flex;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .vpane-action {
          flex: 1;
          height: 2.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          &.bl {
            border-left: 1px solid rgba(255, 255, 255, 0.1);
          }
          &:hover {
            cursor: pointer;
          }
          &.disabled {
            opacity: 0.45;
            &:hover {
              cursor: default;
            }
          }
        }
      `}
    >
      <div className='vpane-head'>
        <div className='vpane-head-title'>Avatar</div>
        <div className='vpane-head-close' onClick={() => world.emit('avatar', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='vpane-content'>
        <div className='vpane-viewport'>
          <div className='vpane-viewport-inner' ref={viewportRef}></div>
        </div>
        <div className='vpane-rank'>{rankText}</div>
        {canEquip && (
          <div className='vpane-details'>
            <div className='vpane-details-toggle' onClick={() => setExpanded(value => !value)}>
              {expanded ? 'Hide details' : 'Expand for details'}
            </div>
            {expanded && (
              <div className='vpane-details-body'>
                {metricRows.map(metric => {
                  const nextTarget =
                    nextRankSpec && Object.prototype.hasOwnProperty.call(nextRankSpec, metric.key)
                      ? METRIC_CONFIGS.find(config => config.key === metric.key)?.format(nextRankSpec[metric.key]) ||
                        '-'
                      : null
                  return (
                    <div className='vpane-details-row' key={metric.key}>
                      <div className='vpane-details-left'>
                        <span className='vpane-details-label'>{metric.label}:</span>
                        <span className='vpane-details-value'>{metric.valueText}</span>
                      </div>
                      <div className='vpane-details-right'>
                        <span className='vpane-details-rank'>R{metric.metricRank}</span>
                        {nextRank && (
                          <span className='vpane-details-target'>{`R${nextRank} ≤ ${nextTarget || '-'}`}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        <div className='vpane-actions'>
          <div
            className={`vpane-action${canEquip ? '' : ' disabled'}`}
            onClick={() => canEquip && info.onEquip(previewInfo)}
          >
            <span>Equip</span>
          </div>
          {info.canPlace && (
            <div className='vpane-action bl' onClick={info.onPlace}>
              <span>Place</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
