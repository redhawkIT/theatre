/* eslint-disable no-restricted-syntax */
import '@theatre/studio'
import {getProject} from '@theatre/core'
import {privateAPI} from '@theatre/core/privateAPIs'
import type {ProjectState_Historic} from '@theatre/core/projects/store/storeTypes'
import type {SheetState_Historic} from '@theatre/core/projects/store/types/SheetState_Historic'
import * as t from '@theatre/core/propTypes'
import getStudio from '@theatre/studio/getStudio'
import coreTicker from '@theatre/core/coreTicker'
import globals from './globals'
/* eslint-enable no-restricted-syntax */

let lastProjectN = 0
export async function setupTestSheet(sheetState: SheetState_Historic) {
  const studio = getStudio()!
  studio.initialize({usePersistentStorage: false})

  const projectState: ProjectState_Historic = {
    definitionVersion: globals.currentProjectStateDefinitionVersion,
    sheetsById: {
      Sheet: sheetState,
    },
    revisionHistory: [],
  }
  const project = getProject('Test Project ' + lastProjectN++, {
    state: projectState,
  })

  const ticker = coreTicker

  ticker.tick()
  await project.ready
  const sheetPublicAPI = project.sheet('Sheet')
  const objPublicAPI = sheetPublicAPI.object('obj', {
    position: {
      x: 0,
      y: t.number(1),
      z: t.number(2),
    },
  })

  const obj = privateAPI(objPublicAPI)

  return {
    obj,
    objPublicAPI,
    sheet: privateAPI(sheetPublicAPI),
    project,
    ticker,
    studio,
  }
}
