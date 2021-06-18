import type {} from '@theatre/core/projects/store/types/SheetState_Historic'
import type {
  PropTypeConfig,
  PropTypeConfig_AllPrimitives,
  PropTypeConfig_Compound,
} from '@theatre/shared/propTypes'
import {isPropConfigComposite} from '@theatre/shared/propTypes/utils'
import type SheetObject from '@theatre/core/sheetObjects/SheetObject'
import type {IPropPathToTrackIdTree} from '@theatre/core/sheetObjects/SheetObjectTemplate'
import type Sheet from '@theatre/core/sheets/Sheet'
import type {PathToProp} from '@theatre/shared/utils/addresses'
import type {SequenceTrackId} from '@theatre/shared/utils/ids'
import type {$FixMe, $IntentionalAny} from '@theatre/shared/utils/types'
import {prism, val} from '@theatre/dataverse'
import {F1Height as F1Height} from '@theatre/studio/panels/ObjectEditorPanel/ObjectEditorPanel'
import logger from '@theatre/shared/logger'

export type SequenceEditorTree_Row<Type> = {
  type: Type
  nodeHeight: number
  heightIncludingChildren: number
  depth: number
  top: number
  n: number
}

export type SequenceEditorTree = SequenceEditorTree_Sheet

export type SequenceEditorTree_Sheet = SequenceEditorTree_Row<'sheet'> & {
  sheet: Sheet
  children: SequenceEditorTree_SheetObject[]
}

export type SequenceEditorTree_SheetObject =
  SequenceEditorTree_Row<'sheetObject'> & {
    sheetObject: SheetObject
    children: Array<
      SequenceEditorTree_PropWithChildren | SequenceEditorTree_PrimitiveProp
    >
  }

export type SequenceEditorTree_PropWithChildren =
  SequenceEditorTree_Row<'propWithChildren'> & {
    sheetObject: SheetObject
    pathToProp: PathToProp
    children: Array<
      SequenceEditorTree_PropWithChildren | SequenceEditorTree_PrimitiveProp
    >
    trackMapping: IPropPathToTrackIdTree
  }

export type SequenceEditorTree_PrimitiveProp =
  SequenceEditorTree_Row<'primitiveProp'> & {
    sheetObject: SheetObject
    pathToProp: PathToProp
    trackId: SequenceTrackId
  }

export type SequenceEditorTree_AllRowTypes =
  | SequenceEditorTree_Sheet
  | SequenceEditorTree_SheetObject
  | SequenceEditorTree_PropWithChildren
  | SequenceEditorTree_PrimitiveProp

const heightOfAnyTitle = 28

/**
 * Must run inside prism()
 */
export const calculateSequenceEditorTree = (
  sheet: Sheet,
): SequenceEditorTree => {
  prism.ensurePrism()
  let topSoFar = F1Height
  let nSoFar = 0

  const tree: SequenceEditorTree = {
    type: 'sheet',
    sheet,
    children: [],
    top: topSoFar,
    depth: -1,
    n: nSoFar,
    nodeHeight: 0,
    heightIncludingChildren: -1, // will defined this later
  }
  topSoFar += tree.nodeHeight
  nSoFar += 1

  for (const [_, sheetObject] of Object.entries(val(sheet.objectsP))) {
    addObject(sheetObject, tree.children, tree.depth + 1)
  }
  tree.heightIncludingChildren = topSoFar - tree.top

  function addObject(
    sheetObject: SheetObject,
    arrayOfChildren: Array<SequenceEditorTree_SheetObject>,
    level: number,
  ) {
    const trackSetups = val(
      sheetObject.template.getMapOfValidSequenceTracks_forStudio(),
    )

    if (Object.keys(trackSetups).length === 0) return

    const row: SequenceEditorTree_SheetObject = {
      type: 'sheetObject',
      top: topSoFar,
      children: [],
      depth: level,
      n: nSoFar,
      sheetObject: sheetObject,
      nodeHeight: heightOfAnyTitle,
      heightIncludingChildren: -1,
    }
    arrayOfChildren.push(row)
    nSoFar += 1
    topSoFar += heightOfAnyTitle

    addProps(
      sheetObject,
      trackSetups,
      [],
      sheetObject.template.config.props,
      row.children,
      level + 1,
    )

    // for (const [propKey, propConfig] of Object.entries(
    //   sheetObject.template.config.props.props,
    // )) {
    //   addProp(sheetObject, [propKey], propConfig, row.children, level + 1)
    // }
    row.heightIncludingChildren = topSoFar - row.top
  }

  function addProps(
    sheetObject: SheetObject,
    trackSetups: IPropPathToTrackIdTree,
    pathSoFar: PathToProp,
    parentPropConfig: PropTypeConfig_Compound<$IntentionalAny>,
    arrayOfChildren: Array<
      SequenceEditorTree_PrimitiveProp | SequenceEditorTree_PropWithChildren
    >,
    level: number,
  ) {
    for (const [propKey, setupOrSetups] of Object.entries(trackSetups)) {
      const propConfig = parentPropConfig.props[propKey]
      if (isPropConfigComposite(propConfig)) continue
      addProp(
        sheetObject,
        setupOrSetups!,
        [...pathSoFar, propKey],
        propConfig,
        arrayOfChildren,
        level,
      )
    }

    for (const [propKey, setupOrSetups] of Object.entries(trackSetups)) {
      const propConfig = parentPropConfig.props[propKey]
      if (!isPropConfigComposite(propConfig)) continue
      addProp(
        sheetObject,
        setupOrSetups!,
        [...pathSoFar, propKey],
        propConfig,
        arrayOfChildren,
        level,
      )
    }
  }

  function addProp(
    sheetObject: SheetObject,
    trackIdOrMapping: SequenceTrackId | IPropPathToTrackIdTree,
    pathToProp: PathToProp,
    conf: PropTypeConfig,
    arrayOfChildren: Array<
      SequenceEditorTree_PrimitiveProp | SequenceEditorTree_PropWithChildren
    >,
    level: number,
  ) {
    if (conf.type === 'compound') {
      const trackMapping =
        trackIdOrMapping as $IntentionalAny as IPropPathToTrackIdTree
      addProp_compound(
        sheetObject,
        trackMapping,
        pathToProp,
        conf,
        arrayOfChildren,
        level,
      )
    } else if (conf.type === 'enum') {
      logger.warn('Prop type enum is not yet supported in the sequence editor')
    } else {
      const trackId = trackIdOrMapping as $IntentionalAny as SequenceTrackId

      addProp_primitive(
        sheetObject,
        trackId,
        pathToProp,
        conf,
        arrayOfChildren,
        level,
      )
    }
  }

  function addProp_compound(
    sheetObject: SheetObject,
    trackMapping: IPropPathToTrackIdTree,
    pathToProp: PathToProp,
    conf: PropTypeConfig_Compound<$FixMe>,
    arrayOfChildren: Array<
      SequenceEditorTree_PrimitiveProp | SequenceEditorTree_PropWithChildren
    >,
    level: number,
  ) {
    const row: SequenceEditorTree_PropWithChildren = {
      type: 'propWithChildren',
      pathToProp,
      sheetObject: sheetObject,
      top: topSoFar,
      children: [],
      nodeHeight: heightOfAnyTitle,
      heightIncludingChildren: -1,
      depth: level,
      trackMapping,
      n: nSoFar,
    }
    topSoFar += heightOfAnyTitle
    nSoFar += 1
    arrayOfChildren.push(row)

    addProps(
      sheetObject,
      trackMapping,
      pathToProp,
      conf,
      row.children,
      level + 1,
    )

    row.heightIncludingChildren = topSoFar - row.top
  }

  function addProp_primitive(
    sheetObject: SheetObject,
    trackId: SequenceTrackId,
    pathToProp: PathToProp,
    conf: PropTypeConfig_AllPrimitives,
    arrayOfChildren: Array<
      SequenceEditorTree_PrimitiveProp | SequenceEditorTree_PropWithChildren
    >,
    level: number,
  ) {
    const row: SequenceEditorTree_PrimitiveProp = {
      type: 'primitiveProp',
      depth: level,
      sheetObject: sheetObject,
      pathToProp,
      top: topSoFar,
      nodeHeight: heightOfAnyTitle,
      heightIncludingChildren: heightOfAnyTitle,
      trackId,
      n: nSoFar,
    }
    arrayOfChildren.push(row)
    nSoFar += 1
    topSoFar += heightOfAnyTitle
  }

  return tree
}

type _Info = {
  propKey: string
  propConfig: PropTypeConfig
  trackIdOrMapping: SequenceTrackId | IPropPathToTrackIdTree
}

function sortTrackSetups(
  trackMapping: IPropPathToTrackIdTree,
  rootPropConfig: $FixMe,
): Array<_Info> {
  const all: _Info[] = Object.entries(trackMapping).map(
    ([propKey, trackIdOrMapping]) => ({
      propKey,
      trackIdOrMapping: trackIdOrMapping!,
      propConfig: rootPropConfig[propKey],
    }),
  )

  const primitives = all.filter(
    ({propConfig}) => !isPropConfigComposite(propConfig),
  )
  const composites = all.filter(({propConfig}) =>
    isPropConfigComposite(propConfig),
  )

  return [...primitives, ...composites]
}
