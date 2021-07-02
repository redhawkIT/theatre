import trackValueAtTime from '@theatre/core/sequences/trackValueAtTime'
import type Sheet from '@theatre/core/sheets/Sheet'
import type {SheetObjectConfig} from '@theatre/core/sheets/TheatreSheet'
import type {SheetObjectAddress} from '@theatre/shared/utils/addresses'
import deepMergeWithCache from '@theatre/shared/utils/deepMergeWithCache'
import type {SequenceTrackId} from '@theatre/shared/utils/ids'
import pointerDeep from '@theatre/shared/utils/pointerDeep'
import SimpleCache from '@theatre/shared/utils/SimpleCache'
import type {
  $FixMe,
  $IntentionalAny,
  SerializableMap,
  SerializableValue,
} from '@theatre/shared/utils/types'
import {valToAtom} from '@theatre/shared/utils/valToAtom'
import type {
  IdentityDerivationProvider,
  IDerivation,
  Pointer,
} from '@theatre/dataverse'

import {Atom, getPointerParts, pointer, prism, val} from '@theatre/dataverse'
import type SheetObjectTemplate from './SheetObjectTemplate'
import TheatreSheetObject from './TheatreSheetObject'

// type Everything = {
//   final: SerializableMap
//   statics: SerializableMap
//   defaults: SerializableMap
//   sequenced: SerializableMap
// }

export default class SheetObject implements IdentityDerivationProvider {
  get type(): 'Theatre_SheetObject' {
    return 'Theatre_SheetObject'
  }
  readonly $$isIdentityDerivationProvider: true = true
  readonly address: SheetObjectAddress
  readonly publicApi: TheatreSheetObject<$IntentionalAny>
  private readonly _initialValue = new Atom<SerializableMap>({})
  private readonly _cache = new SimpleCache()

  constructor(
    readonly sheet: Sheet,
    readonly template: SheetObjectTemplate,
    readonly nativeObject: unknown,
  ) {
    this.address = {
      ...template.address,
      sheetInstanceId: sheet.address.sheetInstanceId,
    }

    this.publicApi = new TheatreSheetObject(this)
  }

  overrideConfig(
    nativeObject: unknown,
    config: SheetObjectConfig<$IntentionalAny>,
  ) {
    if (nativeObject !== this.nativeObject) {
      // @todo
    }

    this.template.overrideConfig(nativeObject, config)
  }

  // getValues(): Record<string, unknown> {
  //   return {}
  // }

  getValues(): IDerivation<Pointer<SerializableMap>> {
    return this._cache.get('getValues()', () =>
      prism(() => {
        const defaults = val(this.template.getDefaultValues())

        const initial = val(this._initialValue.pointer)

        const withInitialCache = prism.memo(
          'withInitialCache',
          () => new WeakMap(),
          [],
        )

        const withInitial = deepMergeWithCache(
          defaults,
          initial,
          withInitialCache,
        )

        const statics = val(this.template.getStaticValues())

        const withStaticsCache = prism.memo(
          'withStatics',
          () => new WeakMap(),
          [],
        )

        const withStatics = deepMergeWithCache(
          withInitial,
          statics,
          withStaticsCache,
        )

        let final = withStatics
        let sequenced

        {
          const pointerToSequencedValuesD = prism.memo(
            'seq',
            () => this.getSequencedValues(),
            [],
          )
          const withSeqsCache = prism.memo(
            'withSeqsCache',
            () => new WeakMap(),
            [],
          )
          sequenced = val(val(pointerToSequencedValuesD))

          const withSeqs = deepMergeWithCache(final, sequenced, withSeqsCache)
          final = withSeqs
        }

        const a = valToAtom<SerializableMap>('finalAtom', final)

        return a.pointer
      }),
    )
  }

  getValueByPointer(pointer: SheetObject['propsP']): SerializableValue {
    const allValuesP = val(this.getValues())
    const {path} = getPointerParts(pointer)

    return val(pointerDeep(allValuesP as $FixMe, path)) as SerializableMap
  }

  getIdentityDerivation(path: Array<string | number>): IDerivation<unknown> {
    /**
     * @todo perf: Too much indirection here.
     */
    return prism(() => {
      const allValuesP = val(this.getValues())
      return val(pointerDeep(allValuesP as $FixMe, path)) as SerializableMap
    })
  }

  /**
   * Returns values of props that are sequenced.
   */
  getSequencedValues(): IDerivation<Pointer<SerializableMap>> {
    return prism(() => {
      const tracksToProcessD = prism.memo(
        'tracksToProcess',
        () => this.template.getArrayOfValidSequenceTracks(),
        [],
      )

      const tracksToProcess = val(tracksToProcessD)
      const valsAtom = new Atom<SerializableMap>({})

      prism.effect(
        'processTracks',
        () => {
          const untaps: Array<() => void> = []

          for (const {trackId, pathToProp} of tracksToProcess) {
            const derivation = this._trackIdToDerivation(trackId)

            const updateSequenceValueFromItsDerivation = () => {
              valsAtom.setIn(pathToProp, derivation.getValue())
            }
            const untap = derivation
              .changesWithoutValues()
              .tap(updateSequenceValueFromItsDerivation)

            updateSequenceValueFromItsDerivation()
            untaps.push(untap)
          }
          return () => {
            for (const untap of untaps) {
              untap()
            }
          }
        },
        tracksToProcess,
      )

      return valsAtom.pointer
    })
  }

  protected _trackIdToDerivation(
    trackId: SequenceTrackId,
  ): IDerivation<unknown> {
    const trackP =
      this.template.project.pointers.historic.sheetsById[this.address.sheetId]
        .sequence.tracksByObject[this.address.objectKey].trackData[trackId]
    const timeD = this.sheet.getSequence().positionDerivation

    return trackValueAtTime(trackP, timeD)
  }

  get propsP(): Pointer<$FixMe> {
    return this._cache.get('propsP', () =>
      pointer<{props: {}}>({root: this, path: []}),
    ) as $FixMe
  }

  validateValue(pointer: Pointer<$FixMe>, value: unknown) {
    // @todo
  }

  setInitialValue(val: SerializableMap) {
    this.validateValue(this.propsP, val)
    this._initialValue.setState(val)
  }
}
