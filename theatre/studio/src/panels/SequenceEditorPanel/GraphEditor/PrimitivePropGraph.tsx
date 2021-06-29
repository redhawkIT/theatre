import type SheetObject from '@theatre/core/sheetObjects/SheetObject'
import getStudio from '@theatre/studio/getStudio'
import type {PathToProp} from '@theatre/shared/utils/addresses'
import type {SequenceTrackId} from '@theatre/shared/utils/ids'
import {usePrism} from '@theatre/dataverse-react'
import type {Pointer} from '@theatre/dataverse'
import {val} from '@theatre/dataverse'
import React from 'react'
import styled from 'styled-components'
import type {SequenceEditorPanelLayout} from '@theatre/studio/panels/SequenceEditorPanel/layout/layout'
import BasicKeyframedTrack from './BasicKeyframedTrack/BasicKeyframedTrack'
import type {graphEditorColors} from './GraphEditor'

const Container = styled.div``

const PrimitivePropGraph: React.FC<{
  layoutP: Pointer<SequenceEditorPanelLayout>
  sheetObject: SheetObject
  pathToProp: PathToProp
  trackId: SequenceTrackId
  color: keyof typeof graphEditorColors
}> = (props) => {
  return usePrism(() => {
    const {sheetObject, trackId, pathToProp} = props
    const trackData = val(
      getStudio()!.atomP.historic.coreByProject[sheetObject.address.projectId]
        .sheetsById[sheetObject.address.sheetId].sequence.tracksByObject[
        sheetObject.address.objectKey
      ].trackData[trackId],
    )

    if (trackData?.type !== 'BasicKeyframedTrack') {
      console.error(
        `trackData type ${trackData?.type} is not yet supported on the graph editor`,
      )
      return <></>
    } else {
      return <BasicKeyframedTrack {...props} trackData={trackData} />
    }
  }, [props.trackId, props.layoutP])
}

export default PrimitivePropGraph
