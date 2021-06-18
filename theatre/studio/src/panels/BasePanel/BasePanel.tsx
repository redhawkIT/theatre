import {val} from '@theatre/dataverse'
import {usePrism} from '@theatre/shared/utils/reactDataverse'
import type {$IntentionalAny} from '@theatre/shared/utils/types'
import getStudio from '@theatre/studio/getStudio'
import type {PanelId, PanelPosition} from '@theatre/studio/store/types'
import React, {useContext} from 'react'
import useWindowSize from 'react-use/esm/useWindowSize'
import styled from 'styled-components'

const Container = styled.div`
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  z-index: 1000;
`

type PanelStuff = {
  panelId: PanelId
  dims: {
    width: number
    height: number
    top: number
    left: number
  }
  minDims: {
    width: number
    height: number
  }
}

export const panelDimsToPanelPosition = (
  dims: PanelStuff['dims'],
  windowDims: {height: number; width: number},
): PanelPosition => {
  const left = dims.left / windowDims.width
  const right = (dims.left + dims.width) / windowDims.width
  const top = dims.top / windowDims.height
  const bottom = (dims.height + dims.top) / windowDims.height

  const position: PanelPosition = {
    edges: {
      left:
        left <= 0.5
          ? {from: 'screenLeft', distance: left}
          : {from: 'screenRight', distance: 1 - left},

      right:
        right <= 0.5
          ? {from: 'screenLeft', distance: right}
          : {from: 'screenRight', distance: 1 - right},

      top:
        top <= 0.5
          ? {from: 'screenTop', distance: top}
          : {from: 'screenBottom', distance: 1 - top},

      bottom:
        bottom <= 0.5
          ? {from: 'screenTop', distance: bottom}
          : {from: 'screenBottom', distance: 1 - bottom},
    },
  }

  return position
}

const PanelContext = React.createContext<PanelStuff>(null as $IntentionalAny)

export const usePanel = () => useContext(PanelContext)

const BasePanel: React.FC<{
  panelId: PanelId
  defaultPosition: PanelPosition
  minDims: {width: number; height: number}
}> = ({panelId, children, defaultPosition, minDims}) => {
  const windowSize = useWindowSize(800, 200)
  const {stuff} = usePrism(() => {
    const {edges} =
      val(getStudio()!.atomP.historic.panelPositions[panelId]) ??
      defaultPosition

    const left = Math.floor(
      windowSize.width *
        (edges.left.from === 'screenLeft'
          ? edges.left.distance
          : 1 - edges.left.distance),
    )

    const right = Math.floor(
      windowSize.width *
        (edges.right.from === 'screenLeft'
          ? edges.right.distance
          : 1 - edges.right.distance),
    )

    const top = Math.floor(
      windowSize.height *
        (edges.top.from === 'screenTop'
          ? edges.top.distance
          : 1 - edges.top.distance),
    )

    const bottom = Math.floor(
      windowSize.height *
        (edges.bottom.from === 'screenTop'
          ? edges.bottom.distance
          : 1 - edges.bottom.distance),
    )

    const width = Math.max(right - left, minDims.width)
    const height = Math.max(bottom - top, minDims.height)

    const stuff: PanelStuff = {
      dims: {
        width,
        left,
        top,
        height,
      },
      panelId,
      minDims,
    }
    return {stuff}
  }, [panelId, windowSize])

  return <PanelContext.Provider value={stuff}>{children}</PanelContext.Provider>
}

export default BasePanel
