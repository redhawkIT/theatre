import logger from '@theatre/shared/logger'
import {privateAPI, setPrivateAPI} from '@theatre/core/privateAPIs'
import {defer} from '@theatre/shared/utils/defer'
import type Sequence from './Sequence'
import type {IPlaybackDirection, IPlaybackRange} from './Sequence'
import AudioPlaybackController from './playbackControllers/AudioPlaybackController'
import coreTicker from '@theatre/core/coreTicker'

interface IAttachAudioArgs {
  /**
   * Either a URL to the audio file (eg "https://localhost/audio.mp3") or an instance of AudioBuffer
   */
  source: string | AudioBuffer
  /**
   * An optional AudioContext. If not provided, one will be created.
   */
  audioContext?: AudioContext
  /**
   * An AudioDestinationNode to feed the audio into. One will be created if not provided.
   */
  destinationNode?: AudioDestinationNode
}

export interface ISequence {
  readonly type: 'Theatre_Sequence_PublicAPI'

  /**
   * Starts playback of a sequence.
   * Returns a promise that either resolves to true when the playback completes,
   * or resolves to false if playback gets interrupted (for example by calling sequence.pause())
   *
   * @returns A promise that resolves when the playback is finished, or rejects if interruped
   *
   * Usage:
   * ```ts
   * // plays the sequence from the current position to sequence.length
   * sheet.sequence.play()
   *
   * // plays the sequence at 2.4x speed
   * sheet.sequence.play({rate: 2.4})
   *
   * // plays the sequence from second 1 to 4
   * sheet.sequence.play({range: [1, 4]})
   *
   * // plays the sequence 4 times
   * sheet.sequence.play({iterationCount: 4})
   *
   * // plays the sequence in reverse
   * sheet.sequence.play({direction: 'reverse'})
   *
   * // plays the sequence back and forth forever (until interrupted)
   * sheet.sequence.play({iterationCount: Infinity, direction: 'alternateReverse})
   *
   * // plays the sequence and logs "done" once playback is finished
   * sheet.sequence.play().then(() => console.log('done'))
   * ```
   */
  play(conf?: {
    /**
     * The number of times the animation must run. Must be an integer larger
     * than 0. Defaults to 1. Pick Infinity to run forever
     */
    iterationCount?: number
    /**
     * Limits the range to be played. Default is [0, sequence.length]
     */
    range?: IPlaybackRange
    /**
     * The playback rate. Defaults to 1. Choosing 2 would play the animation
     * at twice the speed.
     */
    rate?: number
    /**
     * The direction of the playback. Similar to CSS's animation-direction
     */
    direction?: IPlaybackDirection
  }): Promise<boolean>

  /**
   * Pauses the currently playing animation
   */
  pause(): void

  /**
   * The current position of the playhead.
   * In a time-based sequence, this represents the current time in seconds.
   */
  position: number

  /**
   * Attaches an audio source to the sequence. Playing the sequence automatically
   * plays the audio source and their times are kept in sync.
   *
   * @returns A promise that resolves once the audio source is loaded and decoded
   *
   * Usage:
   * ```ts
   * // Loads and decodes audio from the URL and then attaches it to the sequence
   * await sheet.sequence.attachAudio({source: "https://localhost/audio.ogg"})
   * sheet.sequence.play()
   *
   * // Providing your own AudioAPI Context, destination, etc
   * const audioContext: AudioContext = {...} // create an AudioContext using the Audio API
   * const audioBuffer: AudioBuffer = {...} // create an AudioBuffer
   * const destinationNode = audioContext.destination
   *
   * await sheet.sequence.attachAudio({source: audioBuffer, audioContext, destinationNode})
   * ```
   *
   * Note: It's better to provide the `audioContext` rather than allow Theatre to create it.
   * That's because some browsers [suspend the audioContext](https://developer.chrome.com/blog/autoplay/#webaudio)
   * unless it's initiated by a user gesture, like a click. If that happens, Theatre will
   * wait for a user gesture to resume the audioContext. But that's probably not an
   * optimal user experience. It is better to provide a button or some other UI element
   * to communicate to the user that they have to initiate the animation.
   *
   * Example:
   * ```ts
   * // html: <button id="#start">start</button>
   * const button = document.getElementById('start')
   *
   * button.addEventListener('click', async () => {
   *   const audioContext = ...
   *   await sheet.sequence.attachAudio({audioContext, source: '...'})
   *   sheet.sequence.play()
   * })
   * ```
   */
  attachAudio(args: IAttachAudioArgs): Promise<{
    decodedBuffer: AudioBuffer
    audioContext: AudioContext
    destinationNode: AudioDestinationNode
  }>
}

export default class TheatreSequence implements ISequence {
  get type(): 'Theatre_Sequence_PublicAPI' {
    return 'Theatre_Sequence_PublicAPI'
  }

  /**
   * @internal
   */
  constructor(sheet: Sequence) {
    setPrivateAPI(this, sheet)
  }

  play(
    conf?: Partial<{
      iterationCount: number
      range: IPlaybackRange
      rate: number
      direction: IPlaybackDirection
    }>,
  ): Promise<boolean> {
    if (privateAPI(this)._project.isReady()) {
      return privateAPI(this).play(conf)
    } else {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(
          `You seem to have called sequence.play() before the project has finished loading.\n` +
            `This would **not** a problem in production when using '@theatre/core', since Theatre loads instantly in core mode. ` +
            `However, when using '@theatre/studio', it takes a few milliseconds for it to load your project's state, ` +
            `before which your sequences cannot start playing.\n` +
            `\n` +
            `To fix this, simply defer calling sequence.play() until after the project is loaded, like this:\n` +
            `project.ready.then(() => {\n` +
            `  sequence.play()\n` +
            `})`,
        )
      }
      const d = defer<boolean>()
      d.resolve(true)
      return d.promise
    }
  }

  pause() {
    privateAPI(this).pause()
  }

  get position() {
    return privateAPI(this).position
  }

  set position(position: number) {
    privateAPI(this).position = position
  }

  async attachAudio(args: IAttachAudioArgs): Promise<{
    decodedBuffer: AudioBuffer
    audioContext: AudioContext
    destinationNode: AudioDestinationNode
  }> {
    const {audioContext, destinationNode, decodedBuffer} =
      await resolveAudioBuffer(args)

    const playbackController = new AudioPlaybackController(
      coreTicker,
      decodedBuffer,
      audioContext,
      destinationNode,
    )

    privateAPI(this).replacePlaybackController(playbackController)

    return {audioContext, destinationNode, decodedBuffer}
  }
}

async function resolveAudioBuffer(args: IAttachAudioArgs): Promise<{
  decodedBuffer: AudioBuffer
  audioContext: AudioContext
  destinationNode: AudioDestinationNode
}> {
  function getAudioContext(): Promise<AudioContext> {
    if (args.audioContext) return Promise.resolve(args.audioContext)
    const ctx = new AudioContext()
    if (ctx.state === 'running') return Promise.resolve(ctx)

    // AudioContext is suspended, probably because the browser
    // has blocked it since it is not initiated by a user gesture
    return new Promise<AudioContext>((resolve) => {
      const listener = () => {
        ctx.resume()
      }

      const eventsToHookInto: Array<keyof WindowEventMap> = [
        'mousedown',
        'keydown',
        'touchstart',
      ]

      const eventListenerOpts = {capture: true, passive: false}
      eventsToHookInto.forEach((eventName) => {
        window.addEventListener(eventName, listener, eventListenerOpts)
      })

      ctx.addEventListener('statechange', () => {
        if (ctx.state === 'running') {
          eventsToHookInto.forEach((eventName) => {
            window.removeEventListener(eventName, listener, eventListenerOpts)
          })
          resolve(ctx)
        }
      })
    })
  }

  async function getAudioBuffer(): Promise<AudioBuffer> {
    if (args.source instanceof AudioBuffer) {
      return args.source
    }

    const decodedBufferDeferred = defer<AudioBuffer>()
    if (typeof args.source !== 'string') {
      throw new Error(
        `Error validating arguments to sequence.attachAudio(). ` +
          `args.source must either be a string or an instance of AudioBuffer.`,
      )
    }

    let fetchResponse
    try {
      fetchResponse = await fetch(args.source)
    } catch (e) {
      console.error(e)
      throw new Error(
        `Could not fetch '${args.source}'. Network error logged above.`,
      )
    }

    let arrayBuffer
    try {
      arrayBuffer = await fetchResponse.arrayBuffer()
    } catch (e) {
      console.error(e)
      throw new Error(`Could not read '${args.source}' as an arrayBuffer.`)
    }

    const audioContext = await audioContextPromise

    audioContext.decodeAudioData(
      arrayBuffer,
      decodedBufferDeferred.resolve,
      decodedBufferDeferred.reject,
    )

    let decodedBuffer
    try {
      decodedBuffer = await decodedBufferDeferred.promise
    } catch (e) {
      console.error(e)
      throw new Error(`Could not decode ${args.source} as an audio file.`)
    }

    return decodedBuffer
  }

  const audioContextPromise = getAudioContext()
  const audioBufferPromise = getAudioBuffer()

  const [audioContext, decodedBuffer] = await Promise.all([
    audioContextPromise,
    audioBufferPromise,
  ])

  const destinationNode = args.destinationNode || audioContext.destination

  return {
    destinationNode,
    audioContext,
    decodedBuffer,
  }
}
