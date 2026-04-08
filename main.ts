/*
File:      github.com/ETmbit/sumobuilder.ts
Copyright: ETmbit, 2026

License:
This file is part of the ETmbit extensions for MakeCode for micro:bit.
It is free software and you may distribute it under the terms of the
GNU General Public License (version 3 or later) as published by the
Free Software Foundation. The full license text you find at
https://www.gnu.org/licenses.

Disclaimer:
ETmbit extensions are distributed without any warranty.

Dependencies:
ETmbit/general, ETmbit/match
*/

// NOTE:
// ====
// BOF = border of the field
// OOF = outside the field

////////////////
//  INCLUDE   //
//  match.ts  //
////////////////

/*
 * IMPORTANT NOTE
 * ==============
 * A player model should call AT THE START OF EACH ROUTINE AND LOOP:
 *  'if (!Match.isPlaying() || Match.isHalted()) return'
 * This assures a quick reponse to various match conditions.
 */


//##### Declarations #####/


enum Player {
    //% block="green player"
    //% block.loc.nl="groene speler"
    Green,
    //% block="blue player"
    //% block.loc.nl="blauwe speler"
    Blue,
}

enum MatchMessage {
    Reset,
    Stop,
    Play,
    GameOver,
    PointGreen,
    PointBlue,
    DisallowGreen,
    DisallowBlue,
    DisqualGreen,
    DisqualBlue
}

// a depended extension MUST implement 'initHandler'
let initHandler: handler

// see the HALT HANDSHAKING for an explanation of how
// the next handlers interact
let playHandler: handler
let freezeHandler: handler
let inFieldHandler: handler
let toFieldHandler: handler

// optional
let showHandler: handler      // shows extra player information
let pointHandler: handler     // user code by onPoint
let winnerHandler: handler    // user code by onWinner

let EThalted = false
let ETnoplay = false

let ETmatchMsg: MatchMessage = MatchMessage.Reset
let ETprevMatchMsg: MatchMessage = MatchMessage.Reset
let ETplayer: Player = Player.Green
let ETpointsGreen: number = 0
let ETpointsBlue: number = 0
let ETarbiter: number = -1

function display_points() {
    basic.showNumber(ETplayer == Player.Green ? ETpointsGreen : ETpointsBlue)
}

function display_player() {
    basic.showString(ETplayer == Player.Green ? "G" : "B")
}

//##### ETmbit/General handlers #####//

function startHandler() {
    ETplayer = (ETplayer == Player.Green ? Player.Blue : Player.Green)
    if (initHandler) initHandler()
    display_player()
    if (showHandler) showHandler()
}
General.registerStartHandler(startHandler)

function stopHandler() {
    ETmatchMsg = MatchMessage.Stop
    if (freezeHandler) freezeHandler()
}
General.registerStopHandler(stopHandler)

function messageHandler(message: string) {
    ETmatchMsg = +message
    switch (ETmatchMsg) {
        case MatchMessage.Reset:
            ETpointsGreen = 0
            ETpointsBlue = 0
            if (stopHandler) stopHandler()
            if (initHandler) initHandler()
            break
        case MatchMessage.Stop:
            if (stopHandler) stopHandler()
            break
        // case MatchMessage.Play is handled in the forever loop below
        case MatchMessage.GameOver:
            if (ETplayer == Player.Green && ETpointsGreen > ETpointsBlue) {
                if (winnerHandler) winnerHandler()
                if (showHandler) showHandler()
            }
            if (ETplayer == Player.Blue && ETpointsBlue > ETpointsGreen) {
                if (winnerHandler) winnerHandler()
                if (showHandler) showHandler()
            }
            break
        case MatchMessage.PointGreen:
            if (stopHandler) stopHandler()
            ETpointsGreen += 1
            display_points()
            if (ETplayer == Player.Green || ETplayer == ETarbiter) {
                if (pointHandler) pointHandler()
            }
            if ((ETplayer == Player.Green) && showHandler) showHandler()
            break
        case MatchMessage.PointBlue:
            if (stopHandler) stopHandler()
            ETpointsBlue += 1
            display_points()
            if (ETplayer == Player.Blue || ETplayer == ETarbiter) {
                if (pointHandler) pointHandler()
            }
            if ((ETplayer == Player.Blue) && showHandler) showHandler()
            break
        case MatchMessage.DisallowGreen:
            if (ETpointsGreen > 0) ETpointsGreen -= 1
            display_points()
            ETmatchMsg = ETprevMatchMsg
            break
        case MatchMessage.DisallowBlue:
            if (ETpointsBlue > 0) ETpointsBlue -= 1
            display_points()
            ETmatchMsg = ETprevMatchMsg
            break
        case MatchMessage.DisqualGreen:
            if (stopHandler) stopHandler()
            ETpointsGreen = 0
            display_points()
            if ((ETplayer == Player.Blue) && winnerHandler)
                winnerHandler()
            break
        case MatchMessage.DisqualBlue:
            if (stopHandler) stopHandler()
            ETpointsBlue = 0
            display_points()
            if ((ETplayer == Player.Green) && winnerHandler)
                winnerHandler()
            break
    }
    ETprevMatchMsg = ETmatchMsg
}
General.registerMessageHandler("MA", messageHandler)

//##### Match status machine #####//

/*
IMPORTANT:
==========
1)
It is advisded that a dependend extension implements
the 'inFieldHandler' to detect the out-of-field status
of a model. Then it should call 'setOutOfField'

2)
It is obligated that all routines of a dependend extension 
implement 'if (!Match.isPlaying() || Match.isHalted() ) return'
as the first code line of the routine and
as the first code line of each loop

3)
It is advised that a dependend extension implements
the 'freezeHandler' to freeze the model when it is halted.

4)
It is advised that a dependend extension implements
the 'toFieldHandler' to let the model return to the field.

5)
A dependend extension may call 'forceHalting' to invoke the
halt handshaking.

HALT HANDSHAKING:
=================
HALT LOOP detects 'EThalted' flag, see remark 1) and 5)
HALT LOOP sets the 'ETnoplay' flag
HALT LOOP waits for 'EThalted' to be reset
PLAY LOOP finishes : all routines abort, see remark 2)
PLAY LOOP resets the 'EThalted' flag *)
PLAY LOOP waits for 'ETnoplay' to be reset
HALT LOOP calls the 'freezeHandler', see remark 3)
HALT LOOP calls the 'toFieldHandler', see remark 4)
HALT LOOP resets the 'ETnoplay' flag
PLAY LOOP restarts

*) Needed, otherwise the routines of the 'toFieldHandler'
will be blocked.
*/

// PLAY LOOP
basic.forever(function () {
    if (!Match.isPlaying() || ETnoplay) return
    if (playHandler) playHandler()
    EThalted = false
})

// HALT LOOP
basic.forever(function () {
    if (!Match.isPlaying()) return
    if (inFieldHandler) inFieldHandler()
    if (EThalted) {
        ETnoplay = true
        while (EThalted) pause(1)
        if (freezeHandler) freezeHandler() // freezes the robot
        if (toFieldHandler) toFieldHandler() // return to the field
        ETnoplay = false
        return
    }
})

//##### Match namespace #####//

//% color="#00CC00" icon="\uf091"
//% block="Match"
//% block.loc.nl="Wedstrijd"
namespace Match {

    export function isHalted(): boolean {
        return EThalted
    }

    export function forceHalting() {
        EThalted = true
    }

    export function setOutOfField() {
        EThalted = true
    }

    //% block="the opponent"
    //% block.loc.nl="de tegenstander"
    export function getOpponent(): Player {
        return (ETplayer == Player.Green ? Player.Blue : Player.Green)
    }

    //% block="this player"
    //% block.loc.nl="deze speler"
    export function getPlayer(): Player {
        return ETplayer
    }

    //% block="the opponent is the %player"
    //% block.loc.nl="de tegenstander is de %player"
    export function isOpponent(player: Player): boolean {
        return (ETplayer != player)
    }

    //% block="this is the %player"
    //% block.loc.nl="dit is de %player"
    export function isPlayer(player: Player): boolean {
        return (ETplayer == player)
    }

    //% block="the game is in progress"
    //% block.loc.nl="het spel bezig is"
    export function isPlaying(): boolean {
        return (ETmatchMsg == MatchMessage.Play)
    }

    //% color="#802080"
    //% block="code for the winner to celebrat"
    //% block.loc.nl="code om het winnen te vieren"
    export function onWinner(code: () => void): void {
        winnerHandler = code
    }

    //% color="#802080"
    //% block="code for celebrating a point"
    //% block.loc.nl="code om een punt te vieren"
    export function onPoint(code: () => void): void {
        pointHandler = code
    }

    //% color="#802080"
    //% block="code for playing"
    //% block.loc.nl="code om te spelen"
    export function onPlay(code: () => void): void {
        playHandler = code
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

////////////////
//  INCLUDE   //
//  track.ts  //
////////////////

enum TrackType {
    //% block="dark on light"
    //% block.loc.nl="donker op licht"
    DarkOnLight,
    //% block="light on dark"
    //% block.loc.nl="licht op donker"
    LightOnDark,
}

enum TrackMask {
    //% block="two sensors"
    //% block.loc.nl="twee sensoren"
    Track2 = 10,
    //% block="three sensors"
    //% block.loc.nl="drie sensoren"
    Track3 = 14,
    //% block="four sensors"
    //% block.loc.nl="vier sensoren"
    Track4 = 27,
    //% block="five sensors"
    //% block.loc.nl="vijf sensoren"
    Track5 = 31,
}

enum Track {
    //% block="off the track"
    //% block.loc.nl="van de lijn af"
    OffTrack = 0,
    //% block="the track at far left"
    //% block.loc.nl="de lijn op uiterst links"
    FarLeft = 1,
    //% block="the track at left"
    //% block.loc.nl="de lijn op links"
    Left = 2,
    //% block="on the track"
    //% block.loc.nl="op de lijn"
    Mid = 4,
    //% block="the track at right"
    //% block.loc.nl="de lijn op rechts"
    Right = 8,
    //% block="the track at far right"
    //% block.loc.nl="de lijn op uiterst rechts"
    FarRight = 16,
}

function trackPosition(track: number, mask = TrackMask.Track2, tracktype = TrackType.DarkOnLight): Track {
    if (tracktype == TrackType.LightOnDark) track = ~track
    track = (track & mask)

    if (!track)
        return Track.OffTrack
    if (track & 17) { // extreme left or right sensor
        if (track & 4) { // mid sensor too
            if (track & 1) return Track.Left
            if (track & 16) return Track.Right
        }
        else { // whitout mid sensor
            if (track & 1) return Track.FarLeft
            if (track & 16) return Track.FarRight
        }
    }
    if (((track & 10) == 10) ||   // both left and right sensor
        ((track & 4) == track)) // mid sensor only
        return Track.Mid
    if (track & 2)
        return Track.Left
    if (track & 8)
        return Track.Right
    return Track.OffTrack
}

///////////////////
//  END INCLUDE  //
///////////////////

//////////////////////
//  INCLUDE         //
//  px-tracking.ts  //
//////////////////////

namespace PxTracking {

    export class Device {

        port: RJPort
        trackType: TrackType

        constructor(port: RJPort, _type: TrackType) {
            this.port = port
            this.trackType = _type
        }

        setTracktype(_type: TrackType) {
            this.trackType = _type
        }

        fetch(): Track {
            let track = Track.OffTrack
            let rpin = Nezha.digitalPin(this.port, RJLine.LA)
            let lpin = Nezha.digitalPin(this.port, RJLine.LB)
            pins.setPull(rpin, PinPullMode.PullUp)
            pins.setPull(lpin, PinPullMode.PullUp)
            let rsensor = !pins.digitalReadPin(rpin)
            let lsensor = !pins.digitalReadPin(lpin)
            if (rsensor) track += Track.Right
            if (lsensor) track += Track.Left
            return track
        }

        read(): Track {
            let track = this.fetch()
            track = trackPosition(track, TrackMask.Track2, this.trackType)
            return track
        }

        isTrackAtLeft(): boolean {
            let track = this.fetch()
            track = trackPosition(track, TrackMask.Track2, this.trackType)
            return (track == Track.Left || track == Track.FarLeft)
        }

        isTrackAtRight(): boolean {
            let track = this.fetch()
            track = trackPosition(track, TrackMask.Track2, this.trackType)
            return (track == Track.Right || track == Track.FarRight)
        }

        isOnTrack(): boolean {
            let track = this.fetch()
            track = trackPosition(track, TrackMask.Track2, this.trackType)
            return (track == Track.Mid)
        }

        isOffTrack(): boolean {
            let track = this.fetch()
            track = trackPosition(track, TrackMask.Track2, this.trackType)
            return (track == Track.OffTrack)
        }
    }

    export function create(port: RJPort, _type: TrackType = TrackType.DarkOnLight): Device {
        let device = new Device(port, _type)
        return device
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

///////////////////
//  INCLUDE      //
//  ledstrip.ts  //
///////////////////

enum NeopixelMode {
    GRB = 1,
    RGBW = 2,
    RGB = 3
}

namespace Ledstrip {

    export class Device {

        pin: DigitalPin
        max: number
        mode: NeopixelMode
        buffer: Buffer
        size: number
        bright: number = 10

        constructor(pin: DigitalPin, leds: number, mode: NeopixelMode) {
            this.pin = pin
            this.max = leds - 1
            this.mode = mode
            this.size = leds * (mode == NeopixelMode.RGBW ? 4 : 3)
            this.buffer = pins.createBuffer(this.size)
        }

        show() {
            light.sendWS2812Buffer(this.buffer, this.pin)
        }

        setPixelRGB(offset: number, red: number, green: number, blue: number, white: number = 0): void {
            offset *= (this.mode == NeopixelMode.RGBW ? 4 : 3)
            switch (this.mode) {
                case NeopixelMode.GRB:
                    this.buffer[offset + 0] = Math.floor(green * this.bright / 100)
                    this.buffer[offset + 1] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case NeopixelMode.RGB:
                    this.buffer[offset + 0] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 1] = Math.floor(green * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    break;
                case NeopixelMode.RGBW:
                    this.buffer[offset + 0] = Math.floor(red * this.bright / 100);
                    this.buffer[offset + 1] = Math.floor(green * this.bright / 100);
                    this.buffer[offset + 2] = Math.floor(blue * this.bright / 100);
                    this.buffer[offset + 3] = Math.floor(white * this.bright / 100);
                    break;
            }
        }

        setPixelColor(pixel: number, color: Color, white: number = 0): void {
            if (pixel < 0 || pixel >= 8)
                return;
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            this.setPixelRGB(pixel, red, green, blue, white)
        }

        setRGB(red: number, green: number, blue: number, white: number = 0) {
            for (let i = 0; i < 8; ++i)
                this.setPixelRGB(i, red, green, blue, white)
        }

        setColor(color: Color, white: number = 0) {
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            for (let i = 0; i < 8; ++i)
                this.setPixelRGB(i, red, green, blue, white)
        }

        setClear(): void {
            this.buffer.fill(0, 0, this.size);
        }

        setBrightness(brightness: number) {
            if (brightness < 0) brightness = 0
            if (brightness > 100) brightness = 100
            // small steps at low brightness and big steps at high brightness
            brightness = (brightness ^ 2 / 100)
            this.bright = brightness
        }

        setRotate(rotation: Rotate): void {
            let offset = (this.mode == NeopixelMode.RGBW ? 4 : 3)
            if (rotation == Rotate.Clockwise)
                this.buffer.rotate(-offset, 0, this.size)
            else
                this.buffer.rotate(offset, 0, this.size)
        }

        rainbow(rotation: Rotate, pace: Pace = Pace.Normal) {
            if (rotation == Rotate.Clockwise) {
                this.setPixelColor(0, Color.Red)
                this.setPixelColor(1, Color.Orange)
                this.setPixelColor(2, Color.Yellow)
                this.setPixelColor(3, Color.Green)
                this.setPixelColor(4, Color.Blue)
                this.setPixelColor(5, Color.Indigo)
                this.setPixelColor(6, Color.Violet)
                this.setPixelColor(7, Color.Purple)
            }
            else {
                this.setPixelColor(7, Color.Red)
                this.setPixelColor(6, Color.Orange)
                this.setPixelColor(5, Color.Yellow)
                this.setPixelColor(4, Color.Green)
                this.setPixelColor(3, Color.Blue)
                this.setPixelColor(2, Color.Indigo)
                this.setPixelColor(1, Color.Violet)
                this.setPixelColor(0, Color.Purple)
            }
            this.show()
            basic.pause(pace)
            pace = (pace + 1) * 75
            for (let i = 0; i < this.max; i++) {
                this.setRotate(rotation)
                this.show()
                basic.pause(pace)
            }
        }

        snake(color: Color, rotation: Rotate, pace: Pace = Pace.Normal) {
            let rgb = fromColor(color)
            let red = (rgb >> 16) & 0xFF;
            let green = (rgb >> 8) & 0xFF;
            let blue = (rgb) & 0xFF;
            this.setClear();
            this.show()
            pace = (pace + 1) * 75
            for (let i = this.max; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(this.max - i, red, green, blue)
                else
                    this.setPixelRGB(i, red, green, blue)
                this.show()
                basic.pause(pace)
            }
            this.show()
            for (let i = this.max - 1; i >= 0; i--) {
                if (rotation == Rotate.Clockwise)
                    this.setPixelRGB(this.max - i, 0, 0, 0)
                else
                    this.setPixelRGB(i, 0, 0, 0)
                this.show()
                basic.pause(pace)
            }
            if (rotation == Rotate.Clockwise)
                this.setPixelRGB(0, 0, 0, 0)
            else
                this.setPixelRGB(this.max, 0, 0, 0)
            this.show()
            basic.pause(pace)
        }
    }

    export function create(pin: DigitalPin, leds: number, mode: NeopixelMode = NeopixelMode.GRB): Device {
        let device = new Device(pin, leds, mode)
        return device
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

//////////////////
//  INCLUDE     //
//  vl53l1x.ts  //
//////////////////

/*
The code below is a copy of:
- the HealthyWalk VL53L1X library:
  https://github.com/healthywalk/vl53l1x-microbit/main.ts

The only difference is, that here it is stripped from the
typescript codeblock information so that it won't show up
in MakeCode as a menu on its own.

MIT-license.
*/

namespace VL53L1X {
    type ResultBuffer = {
        range_status: number
        stream_count: number
        dss_actual_effective_spads_sd0: number
        ambient_count_rate_mcps_sd0: number
        final_crosstalk_corrected_range_mm_sd0: number
        peak_signal_count_rate_crosstalk_corrected_mcps_sd0: number
    }
    enum RangeStatus {
        RangeValid = 0,
        SigmaFail = 1,
        SignalFail = 2,
        RangeValidMinRangeClipped = 3,
        OutOfBoundsFail = 4,
        HardwareFail = 5,
        RangeValidNoWrapCheckFail = 6,
        WrapTargetFail = 7,
        XtalkSignalFail = 9,
        SynchronizationInt = 10,
        MinRangeFail = 13,
        None = 255,
    }
    type RangingData = {
        range_mm?: number
        range_status?: RangeStatus
        peak_signal_count_rate_MCPS?: number
        ambient_count_rate_MCPS?: number
    }
    const SOFT_RESET = 0x0000
    const OSC_MEASURED__FAST_OSC__FREQUENCY = 0x0006
    const VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND = 0x0008
    const VHV_CONFIG__INIT = 0x000B
    const ALGO__PART_TO_PART_RANGE_OFFSET_MM = 0x001E
    const MM_CONFIG__OUTER_OFFSET_MM = 0x0022
    const DSS_CONFIG__TARGET_TOTAL_RATE_MCPS = 0x0024
    const PAD_I2C_HV__EXTSUP_CONFIG = 0x002E
    const GPIO__TIO_HV_STATUS = 0x0031
    const SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS = 0x0036
    const SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS = 0x0037
    const ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM = 0x0039
    const ALGO__RANGE_IGNORE_VALID_HEIGHT_MM = 0x003E
    const ALGO__RANGE_MIN_CLIP = 0x003F
    const ALGO__CONSISTENCY_CHECK__TOLERANCE = 0x0040
    const CAL_CONFIG__VCSEL_START = 0x0047
    const PHASECAL_CONFIG__TIMEOUT_MACROP = 0x004B
    const PHASECAL_CONFIG__OVERRIDE = 0x004D
    const DSS_CONFIG__ROI_MODE_CONTROL = 0x004F
    const SYSTEM__THRESH_RATE_HIGH = 0x0050
    const SYSTEM__THRESH_RATE_LOW = 0x0052
    const DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT = 0x0054
    const DSS_CONFIG__APERTURE_ATTENUATION = 0x0057
    const MM_CONFIG__TIMEOUT_MACROP_A = 0x005A
    const MM_CONFIG__TIMEOUT_MACROP_B = 0x005C
    const RANGE_CONFIG__TIMEOUT_MACROP_A = 0x005E
    const RANGE_CONFIG__VCSEL_PERIOD_A = 0x0060
    const RANGE_CONFIG__TIMEOUT_MACROP_B = 0x0061
    const RANGE_CONFIG__VCSEL_PERIOD_B = 0x0063
    const RANGE_CONFIG__SIGMA_THRESH = 0x0064
    const RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS = 0x0066
    const RANGE_CONFIG__VALID_PHASE_HIGH = 0x0069
    const SYSTEM__GROUPED_PARAMETER_HOLD_0 = 0x0071
    const SYSTEM__SEED_CONFIG = 0x0077
    const SD_CONFIG__WOI_SD0 = 0x0078
    const SD_CONFIG__WOI_SD1 = 0x0079
    const SD_CONFIG__INITIAL_PHASE_SD0 = 0x007A
    const SD_CONFIG__INITIAL_PHASE_SD1 = 0x007B
    const SYSTEM__GROUPED_PARAMETER_HOLD_1 = 0x007C
    const SD_CONFIG__QUANTIFIER = 0x007E
    const SYSTEM__SEQUENCE_CONFIG = 0x0081
    const SYSTEM__GROUPED_PARAMETER_HOLD = 0x0082
    const SYSTEM__INTERRUPT_CLEAR = 0x0086
    const SYSTEM__MODE_START = 0x0087
    const RESULT__RANGE_STATUS = 0x0089
    const PHASECAL_RESULT__VCSEL_START = 0x00D8
    const RESULT__OSC_CALIBRATE_VAL = 0x00DE
    const FIRMWARE__SYSTEM_STATUS = 0x00E5
    const TargetRate = 0x0A00
    const TimingGuard = 4528
    const i2cAddr = 0x29
    const io_timeout = 500

    let calibrated: boolean = false
    let fast_osc_frequency = 1
    let saved_vhv_init = 0
    let saved_vhv_timeout = 0
    let results: ResultBuffer = {
        range_status: 0,
        stream_count: 0,
        dss_actual_effective_spads_sd0: 0,
        ambient_count_rate_mcps_sd0: 0,
        final_crosstalk_corrected_range_mm_sd0: 0,
        peak_signal_count_rate_crosstalk_corrected_mcps_sd0: 0
    }
    let ranging_data: RangingData = {}
    let osc_calibrate_val = 0
    let timeout_start_ms = 0

    /**
     * VL53L1X Initialize
     */
    export function init(): void {
        writeReg(SOFT_RESET, 0x00)
        basic.pause(1)
        writeReg(SOFT_RESET, 0x01)
        basic.pause(1)
        startTimeout()
        while ((readReg(FIRMWARE__SYSTEM_STATUS) & 0x01) == 0) {
            if (checkTimeoutExpired()) {
                return
            }
        }
        writeReg(PAD_I2C_HV__EXTSUP_CONFIG,
            readReg(PAD_I2C_HV__EXTSUP_CONFIG) | 0x01)
        fast_osc_frequency = readReg16Bit(OSC_MEASURED__FAST_OSC__FREQUENCY)
        osc_calibrate_val = readReg16Bit(RESULT__OSC_CALIBRATE_VAL)
        writeReg16Bit(DSS_CONFIG__TARGET_TOTAL_RATE_MCPS, TargetRate)
        writeReg(GPIO__TIO_HV_STATUS, 0x02)
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_PULSE_WIDTH_NS, 8)
        writeReg(SIGMA_ESTIMATOR__EFFECTIVE_AMBIENT_WIDTH_NS, 16)
        writeReg(ALGO__CROSSTALK_COMPENSATION_VALID_HEIGHT_MM, 0x01)
        writeReg(ALGO__RANGE_IGNORE_VALID_HEIGHT_MM, 0xFF)
        writeReg(ALGO__RANGE_MIN_CLIP, 0)
        writeReg(ALGO__CONSISTENCY_CHECK__TOLERANCE, 2)

        writeReg16Bit(SYSTEM__THRESH_RATE_HIGH, 0x0000)
        writeReg16Bit(SYSTEM__THRESH_RATE_LOW, 0x0000)
        writeReg(DSS_CONFIG__APERTURE_ATTENUATION, 0x38)

        writeReg16Bit(RANGE_CONFIG__SIGMA_THRESH, 360)
        writeReg16Bit(RANGE_CONFIG__MIN_COUNT_RATE_RTN_LIMIT_MCPS, 192)

        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_0, 0x01)
        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD_1, 0x01)
        writeReg(SD_CONFIG__QUANTIFIER, 2)

        writeReg(SYSTEM__GROUPED_PARAMETER_HOLD, 0x00)
        writeReg(SYSTEM__SEED_CONFIG, 1)
        writeReg(SYSTEM__SEQUENCE_CONFIG, 0x8B)
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 200 << 8)
        writeReg(DSS_CONFIG__ROI_MODE_CONTROL, 2)
        setLongDistanceMode()
        setMeasurementTimingBudget(50000)
        writeReg16Bit(ALGO__PART_TO_PART_RANGE_OFFSET_MM,
            readReg16Bit(MM_CONFIG__OUTER_OFFSET_MM) * 4)
    }

    /**
     * Read distance in cm
     */
    export function read(): number {
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01)
        writeReg(SYSTEM__MODE_START, 0x10)
        return Math.round(readRaw() / 10)
    }

    function setLongDistanceMode(): void {
        writeReg(RANGE_CONFIG__VCSEL_PERIOD_A, 0x0F)
        writeReg(RANGE_CONFIG__VCSEL_PERIOD_B, 0x0D)
        writeReg(RANGE_CONFIG__VALID_PHASE_HIGH, 0xB8)
        writeReg(SD_CONFIG__WOI_SD0, 0x0F)
        writeReg(SD_CONFIG__WOI_SD1, 0x0D)
        writeReg(SD_CONFIG__INITIAL_PHASE_SD0, 14)
        writeReg(SD_CONFIG__INITIAL_PHASE_SD1, 14)
    }

    function setMeasurementTimingBudget(budget_us: number): boolean {
        if (budget_us <= TimingGuard) { return false }
        budget_us -= TimingGuard
        let range_config_timeout_us = budget_us
        if (range_config_timeout_us > 1100000) { return false }
        range_config_timeout_us = Math.floor(range_config_timeout_us / 2)
        let macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_A))
        let phasecal_timeout_mclks = timeoutMicrosecondsToMclks(1000, macro_period_us)
        if (phasecal_timeout_mclks > 0xFF) { phasecal_timeout_mclks = 0xFF }
        writeReg(PHASECAL_CONFIG__TIMEOUT_MACROP, phasecal_timeout_mclks)
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)))
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_A, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
        macro_period_us = calcMacroPeriod(readReg(RANGE_CONFIG__VCSEL_PERIOD_B))
        writeReg16Bit(MM_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(1, macro_period_us)))
        writeReg16Bit(RANGE_CONFIG__TIMEOUT_MACROP_B, encodeTimeout(
            timeoutMicrosecondsToMclks(range_config_timeout_us, macro_period_us)))
        return true
    }


    export function readRaw(): number {
        startTimeout()
        while (!dataReady()) {
            if (checkTimeoutExpired()) {
                return 0
            }
        }
        readResults()
        if (!calibrated) {
            setupManualCalibration()
            calibrated = true
        }
        updateDSS()
        let range = results.final_crosstalk_corrected_range_mm_sd0
        ranging_data.range_mm = Math.floor((range * 2011 + 0x0400) / 0x0800)
        writeReg(SYSTEM__INTERRUPT_CLEAR, 0x01)
        if (results.range_status == 4) ranging_data.range_mm = 9999
        return ranging_data.range_mm
    }

    function setupManualCalibration(): void {
        saved_vhv_init = readReg(VHV_CONFIG__INIT)
        saved_vhv_timeout = readReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND)
        writeReg(VHV_CONFIG__INIT, saved_vhv_init & 0x7F)
        writeReg(VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND,
            (saved_vhv_timeout & 0x03) + (3 << 2))
        writeReg(PHASECAL_CONFIG__OVERRIDE, 0x01)
        writeReg(CAL_CONFIG__VCSEL_START, readReg(PHASECAL_RESULT__VCSEL_START))
    }

    function readResults(): void {
        pins.i2cWriteNumber(i2cAddr, RESULT__RANGE_STATUS, NumberFormat.UInt16BE, false)
        let buf = pins.i2cReadBuffer(i2cAddr, 17, false)
        results.range_status = buf.getNumber(NumberFormat.UInt8BE, 0)
        results.stream_count = buf.getNumber(NumberFormat.UInt8BE, 2)
        results.dss_actual_effective_spads_sd0 = buf.getNumber(NumberFormat.UInt16BE, 3)
        results.ambient_count_rate_mcps_sd0 = buf.getNumber(NumberFormat.UInt16BE, 7)
        results.final_crosstalk_corrected_range_mm_sd0 = buf.getNumber(NumberFormat.UInt16BE, 13)
        results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 = buf.getNumber(NumberFormat.UInt16BE, 15)
    }

    function updateDSS(): void {
        let spadCount = results.dss_actual_effective_spads_sd0
        if (spadCount != 0) {
            let totalRatePerSpad =
                results.peak_signal_count_rate_crosstalk_corrected_mcps_sd0 +
                results.ambient_count_rate_mcps_sd0
            if (totalRatePerSpad > 0xFFFF) { totalRatePerSpad = 0xFFFF }
            totalRatePerSpad <<= 16
            totalRatePerSpad = Math.floor(totalRatePerSpad / spadCount)
            if (totalRatePerSpad != 0) {
                let requiredSpads = Math.floor((TargetRate << 16) / totalRatePerSpad)
                if (requiredSpads > 0xFFFF || requiredSpads < 0) { requiredSpads = 0xFFFF }
                writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, requiredSpads)
                return
            }
        }
        writeReg16Bit(DSS_CONFIG__MANUAL_EFFECTIVE_SPADS_SELECT, 0x8000)
    }

    function writeReg(reg: number, d: number): void {
        let buf = pins.createBuffer(3)
        buf.setNumber(NumberFormat.UInt16BE, 0, reg)
        buf.setNumber(NumberFormat.UInt8BE, 2, d)
        pins.i2cWriteBuffer(i2cAddr, buf, false)
    }

    function writeReg16Bit(reg: number, d: number): void {
        let tmp = (reg << 16) | d
        pins.i2cWriteNumber(i2cAddr, tmp, NumberFormat.UInt32BE, false)
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt8BE, false)
        return d
    }

    function readReg16Bit(reg: number): number {
        pins.i2cWriteNumber(i2cAddr, reg, NumberFormat.UInt16BE, false)
        let d = pins.i2cReadNumber(i2cAddr, NumberFormat.UInt16BE, false)
        return d
    }

    function encodeTimeout(timeout_mclks: number): number {
        let ls_byte = 0
        let ms_byte = 0
        if (timeout_mclks > 0) {
            ls_byte = timeout_mclks - 1
            while ((ls_byte & 0xFFFFFF00) > 0) {
                ls_byte >>= 1
                ms_byte++
            }
            return (ms_byte << 8) | (ls_byte & 0xFF)
        } else {
            return 0
        }
    }

    function timeoutMicrosecondsToMclks(timeout_us: number, macro_period_us: number): number {
        return Math.floor(((timeout_us << 12) + (macro_period_us >> 1)) / macro_period_us)
    }

    function calcMacroPeriod(vcsel_period: number): number {
        let pll_period_us = Math.floor((0x01 << 30) / fast_osc_frequency)
        let vcsel_period_pclks = (vcsel_period + 1) << 1

        let macro_period_us = 2304 * pll_period_us
        macro_period_us >>= 6
        macro_period_us *= vcsel_period_pclks
        macro_period_us >>= 6
        return macro_period_us
    }

    function startTimeout(): void {
        timeout_start_ms = input.runningTime()
    }

    function checkTimeoutExpired(): boolean {
        return (io_timeout > 0) && ((input.runningTime() - timeout_start_ms) > io_timeout)
    }

    function dataReady(): boolean {
        return (readReg(GPIO__TIO_HV_STATUS) & 0x01) == 0
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

////////////////
//  INCLUDE   //
//  nezha.ts  //
////////////////

enum RJPort {
    //% block="port J1"
    //% bloc.loc.nl="poort J1"
    J1,
    //% block="port J2"
    //% bloc.loc.nl="poort J2"
    J2,
    //% block="port J3"
    //% bloc.loc.nl="poort J3"
    J3,
    //% block="port J4"
    //% bloc.loc.nl="poort J4"
    J4,
}

enum RJLine {
    //% block="line A"
    LA,
    //% block="line B"
    LB,
}

enum MotorPort {
    //% block="M1"
    M1,
    //% block="M2"
    M2,
    //% block="M3"
    M3,
    //% block="M4"
    M4,
}

enum MotorPosition {
    Left,
    Right,
    FrontLeft,
    FrontRight,
    RearLeft,
    RearRight,
}

type Motor = { Port: MotorPort, Revert: boolean }

namespace Nezha {

    let AnalogRJ = [AnalogPin.P8, AnalogPin.P1,
    AnalogPin.P12, AnalogPin.P2,
    AnalogPin.P14, AnalogPin.P13,
    AnalogPin.P16, AnalogPin.P15]

    let DigitalRJ = [DigitalPin.P8, DigitalPin.P1,
    DigitalPin.P12, DigitalPin.P2,
    DigitalPin.P14, DigitalPin.P13,
    DigitalPin.P16, DigitalPin.P15]

    let MFL: Motor = { Port: MotorPort.M1, Revert: false }
    let MRL: Motor = { Port: MotorPort.M2, Revert: false }
    let MFR: Motor = { Port: MotorPort.M3, Revert: false }
    let MRR: Motor = { Port: MotorPort.M4, Revert: false }

    export function analogPin(port: RJPort, line: RJLine): AnalogPin {
        return AnalogRJ[port * 2 + line]
    }

    export function digitalPin(port: RJPort, line: RJLine): DigitalPin {
        return DigitalRJ[port * 2 + line]
    }

    export function setTwoWheelMotors(left: Motor, right: Motor) {
        MFL = left
        MFR = right
    }

    export function setFourWheelMotors(frontleft: Motor, frontright: Motor,
        rearleft: Motor, rearright: Motor) {
        MFL = frontleft
        MFR = frontright
        MRL = rearleft
        MFR = rearright
    }

    export function getMotor(position: MotorPosition): Motor {
        switch (position) {
            case MotorPosition.Left: return MFL
            case MotorPosition.Right: return MFR
            case MotorPosition.FrontLeft: return MFL
            case MotorPosition.FrontRight: return MFR
            case MotorPosition.RearLeft: return MRL
            case MotorPosition.RearRight: return MRR
        }
        return MFL
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

/////////////////////
//  INCLUDE        //
//  nezhabrick.ts  //
/////////////////////

/*
The code below is a refactoring of:
- the ElecFreaks 'pxt-nezha' library:
  https://github.com/elecfreaks/pxt-nezha/blob/master/main.ts
MIT-license.
*/

enum ServoPort {
    S1,
    S2,
    S3,
    S4,
}

enum ServoType {
    Continuous = 0,
    ST90 = 90,
    ST180 = 180,
    ST270 = 270,
    ST360 = 360,
}

namespace NezhaBrick {

    // MOTOR MODULE

    // speed in %
    export function motorSpeed(port: MotorPort, speed: number): void {

        let iic_buffer = pins.createBuffer(4);

        if (speed > 100) speed = 100
        else
            if (speed < -100) speed = -100

        iic_buffer[0] = port + 1
        if (speed >= 0) {
            iic_buffer[1] = 0x01; // forward
            iic_buffer[2] = speed;
        }
        else {
            iic_buffer[1] = 0x02; // reverse
            iic_buffer[2] = -speed;
        }
        iic_buffer[3] = 0;

        pins.i2cWriteBuffer(0x10, iic_buffer);
    }

    // speed in %
    export function twoWheelSpeed(left: number, right: number) {
        // supply positive values to obtain 'forward' spinning
        let ml = Nezha.getMotor(MotorPosition.FrontLeft)
        let mr = Nezha.getMotor(MotorPosition.FrontRight)
        motorSpeed(ml.Port, ml.Revert ? -left : left)
        motorSpeed(mr.Port, mr.Revert ? -right : right)
    }

    // speed in %
    export function fourWheelSpeed(frontleft: number, frontright: number, rearleft: number, rearright: number) {
        // supply positive values to obtain 'forward' spinning
        let mfl = Nezha.getMotor(MotorPosition.FrontLeft)
        let mfr = Nezha.getMotor(MotorPosition.FrontRight)
        let mrl = Nezha.getMotor(MotorPosition.RearLeft)
        let mrr = Nezha.getMotor(MotorPosition.RearRight)
        motorSpeed(mfl.Port, mfl.Revert ? -frontleft : frontleft)
        motorSpeed(mfr.Port, mfr.Revert ? -frontright : frontright)
        motorSpeed(mrl.Port, mrl.Revert ? -rearleft : rearleft)
        motorSpeed(mrr.Port, mrr.Revert ? -rearright : rearright)
    }

    export function twoWheelStop() {
        twoWheelSpeed(0, 0)
    }

    export function fourWheelStop() {
        fourWheelSpeed(0, 0, 0, 0)
    }

    // SERVO MODULE

    let Servos = [180, 180, 180, 180] // all ServoType.ST180

    export function setServoType(port: ServoPort, _type: ServoType) {
        Servos[port] = _type
    }

    export function servoAngle(port: ServoPort, angle: number): void {
        angle = Math.map(angle, 0, Servos[port], 0, 180)
        let iic_buffer = pins.createBuffer(4);
        iic_buffer[0] = 0x10 + port
        iic_buffer[1] = angle;
        iic_buffer[2] = 0;
        iic_buffer[3] = 0;
        pins.i2cWriteBuffer(0x10, iic_buffer);
    }

    export function servoSpeed(port: ServoPort, speed: number): void {
        if (Servos[port] != ServoType.ST180) return
        speed = Math.map(speed, -100, 100, 0, 180)
        let iic_buffer = pins.createBuffer(4);
        iic_buffer[0] = 0x10 + port
        iic_buffer[1] = speed;
        iic_buffer[2] = 0;
        iic_buffer[3] = 0;
        pins.i2cWriteBuffer(0x10, iic_buffer);
    }
}

///////////////////
//  END INCLUDE  //
///////////////////

Nezha.setTwoWheelMotors({ Port: MotorPort.M2, Revert: false },
    { Port: MotorPort.M3, Revert: false })

let ETsensorBOF = PxTracking.create(RJPort.J1, TrackType.LightOnDark)
let ETsensorOOF = PxTracking.create(RJPort.J2, TrackType.LightOnDark)
let ETledRing = Ledstrip.create(Nezha.digitalPin(RJPort.J3, RJLine.LA), 8)
VL53L1X.init()

NezhaBrick.setServoType(ServoPort.S4, ServoType.ST360)
NezhaBrick.servoAngle(ServoPort.S4, 180)

enum Bend {
    //% block="go straight"
    //% block.loc.nl="ga rechtdoor"
    None,
    //% block="turn to the left"
    //% block.loc.nl="draai naar links"
    Left,
    //% block="turn to the right"
    //% block.loc.nl="draai naar rechts"
    Right
}

// pre-declared in ETmbit/match
showHandler = (): void => {
    if (ETplayer == Player.Green)
        ETledRing.setColor(Color.Green)
    else
        ETledRing.setColor(Color.Blue)
    ETledRing.show()
}

// pre-declared in ETmbit/match
freezeHandler = (): void => {
    // stop
    NezhaBrick.twoWheelSpeed(0, 0)
    // lever down
    NezhaBrick.servoAngle(ServoPort.S4, 180)
}

// pre-declared in ETmbit/match
initHandler = (): void => {
    ETpointsGreen = 0
    ETpointsBlue = 0
    freezeHandler()
    showHandler()
    basic.showNumber(0)
}

// pre-declared in ETmbit/match
inFieldHandler = (): void => {
    if (ETsensorBOF.read() != Track.OffTrack) {
        // out of field
        ETledRing.setColor(Color.Magenta)
        ETledRing.show()
        Match.setOutOfField()
    }
    else
        // in field
        showHandler()
}

basic.forever(function () {
    if (ETsensorOOF.read() != Track.OffTrack) {
        // game over
        ETledRing.setColor(Color.Red)
        ETledRing.show()
        if (ETplayer == Player.Green) {
            ETmatchMsg = MatchMessage.PointBlue
            ETpointsBlue += 1
        }
        else {
            ETmatchMsg = MatchMessage.PointGreen
            ETpointsGreen += 1
        }
        General.sendRadioMessage("MA", ETmatchMsg)
        if (freezeHandler) freezeHandler()
    }
})

namespace SumoBuilder {

    let fielddiameter = 120 // cm
    let neardistance = 15 //cm

    export function isInField(): boolean {
        return (ETsensorBOF.read() == Track.OffTrack && 
            ETsensorOOF.read() == Track.OffTrack)
    }

    export function isOnBorder(): boolean {
        return (ETsensorBOF.read() != Track.OffTrack)
    }

    export function isOutOfField(): boolean {
        return (ETsensorOOF.read() != Track.OffTrack)
    }

    export function isDistNoTrace(): boolean {
        return (VL53L1X.read() > fielddiameter)
    }

    export function isDistTraced(): boolean {
        return (VL53L1X.read() <= fielddiameter)
    }

    export function isDistFar(): boolean {
        let cm = VL53L1X.read()
        return (cm > neardistance && cm <= fielddiameter)
    }

    export function isDistNear(): boolean {
        return (VL53L1X.read() <= neardistance)
    }

    export function setFieldDiameter(diameter: number) {
        fielddiameter = diameter
    }

    export function setNearDistance(distance: number) {
        neardistance = distance
    }

    export function leverDown() {
        NezhaBrick.servoAngle(ServoPort.S4, 180)
    }

    export function leverUp() {
        NezhaBrick.servoAngle(ServoPort.S4, 210)
    }

    export function returnToField() {
        if (!Match.isPlaying() || Match.isHalted()) return
        NezhaBrick.twoWheelSpeed(-20, -20)
        General.wait(2)
        NezhaBrick.twoWheelSpeed(0, 0)
    }

    export function runToRandom() {
        if (!Match.isPlaying() || Match.isHalted()) return
        NezhaBrick.twoWheelSpeed(20, -20)
        let tm = control.millis() + General.randomInt(500, 1500)
        while (tm > control.millis()) {
            if (!Match.isPlaying() || Match.isHalted()) return
            basic.pause(1)
        }
        NezhaBrick.twoWheelSpeed(30, 30)
        tm = control.millis() + General.randomInt(500, 1500)
        while (tm > control.millis()) {
            if (!Match.isPlaying() || Match.isHalted()) return
            basic.pause(1)
        }
        return
    }

    export function pushOpp() {
        if (!Match.isPlaying() || Match.isHalted()) return
        NezhaBrick.twoWheelSpeed(50, 50)
        let tm = control.millis() + 5000
        while (isInField()) {
            if (!Match.isPlaying() || Match.isHalted()) return
            basic.pause(1)
        }
        return
    }

    export function runToOpp(): boolean {
        if (!Match.isPlaying() || Match.isHalted()) return false
        NezhaBrick.twoWheelSpeed(30, 30)
        let tm = control.millis() + 5000
        let cm = VL53L1X.read()
        while (cm > 40) {
            if (!Match.isPlaying() || Match.isHalted()) return false
            if (cm > fielddiameter) return false
            basic.pause(1)
        }
        return true
    }

    export function traceOpp(): boolean {
        if (!Match.isPlaying() || Match.isHalted()) return false
        NezhaBrick.twoWheelSpeed(12, -12)
        let tm = control.millis() + 5000
        let cm = VL53L1X.read()
        while (cm > 40) {
            if (!Match.isPlaying() || Match.isHalted()) return false
            if (tm < control.millis()) {
                NezhaBrick.twoWheelStop()
                return false
            }
            basic.pause(1)
        }
        return true
    }

    export function turn(rotation: Rotate, speed: number) {
        if (!Match.isPlaying() || Match.isHalted()) return
        if (rotation == Rotate.Clockwise)
            NezhaBrick.twoWheelSpeed(-speed / 2, speed / 2)
        else
            NezhaBrick.twoWheelSpeed(speed / 2, -speed / 2)
    }

    export function move(dir: Move, speed: number, bend: Bend) {
        if (!Match.isPlaying() || Match.isHalted()) return
        let spd: number
        if (dir == Move.Forward) spd = speed
        else spd = -speed
        switch (bend) {
            case Bend.None: NezhaBrick.twoWheelSpeed(spd, spd); break;
            case Bend.Left: NezhaBrick.twoWheelSpeed(spd / 2, spd); break;
            case Bend.Right: NezhaBrick.twoWheelSpeed(spd, spd / 2); break;
        }
    }

    export function stop() {
        freezeHandler()
    }

    export function tornado() {
        let on = true
        for (let speed = 10; speed < 50; speed += 5) {
            if (on) {
                ETledRing.setClear()
                ETledRing.show()
            }
            else {
                if (showHandler) showHandler()
            }
            on = !on
            NezhaBrick.twoWheelSpeed(speed, -speed)
            basic.pause(200)
        }
        for (let speed = 50; speed >= 0; speed -= 5) {
            if (on) {
                ETledRing.setClear()
                ETledRing.show()
            }
            else {
                if (showHandler) showHandler()
            }
            on = !on
            NezhaBrick.twoWheelSpeed(speed, -speed)
            basic.pause(200)
        }
        if (showHandler) showHandler()
    }

    export function shake() {
        for (let i = 0; i < 6; i++) {
            NezhaBrick.twoWheelSpeed(30, 30)
            basic.pause(200)
            ETledRing.setClear()
            ETledRing.show()
            NezhaBrick.twoWheelSpeed(-30, -30)
            basic.pause(230)
        }
        NezhaBrick.twoWheelSpeed(0, 0)
        if (showHandler) showHandler()
    }
}

//% color="#FF66AA" icon="\uf06e"
//% block="Led show"
//% block.loc.nl="Led show"
namespace Ledshow {

    let pace = Pace.Normal

    //% block="rotate at %pace pace"
    //% block.loc.nl="draai in %pace tempo"
    export function setPace(_pace: Pace) {
        pace = _pace
    }

    //% block="set brightness to %bright \\%"
    //% block.loc.nl="stel de helderheid in op %bright \\%"
    //% bright.min=0 bright.max=100
    export function setBrightness(brightness: number) {
        ETledRing.setBrightness(brightness)
    }

    //% block="show color %color"
    //% block.loc.nl="toon de kleur %color"
    //% color.defl=Color.White
    export function showColor(color: Color) {
        ETledRing.setColor(color)
        ETledRing.show()
    }

    //% block="rotate a snake %rotation with color %color"
    //% block.loc.nl="draai een slang %rotation met kleur %color"
    //% color.defl=Color.White
    export function showSnake(rotation: Rotate, color: Color) {
        ETledRing.snake(color, rotation, pace)
    }

    //% block="rotate rainbow %rotation"
    //% block.loc.nl="draai een regenboog %rotation"
    export function showRainbow(rotation: Rotate) {
        ETledRing.rainbow(rotation, pace)
    }

    //% subcategory="Leds apart"
    //% block="rotate a full circle %rotation at %pace pace"
    //% block.loc.nl="draai een hele cirkel %rotation in %pace tempo"
    //% pace.defl=Pace.Normal
    export function circleLeds(rotation: Rotate) {
        ETledRing.show()
        for (let i = 0; i <= 7; i++) {
            ETledRing.setRotate(rotation)
            ETledRing.show()
            basic.pause((pace + 1) * 50)
        }
    }

    //% subcategory="Leds apart"
    //% block="rotate one position %rotation"
    //% block.loc.nl="draai één positie %rotation"
    export function rotateLeds(rotation: Rotate) {
        ETledRing.setRotate(rotation)
        ETledRing.show()
    }

    //% subcategory="Leds apart"
    //% block="turn all leds off"
    //% block.loc.nl="schakel alle leds uit"
    export function ledsOff() {
        ETledRing.setClear()
        ETledRing.show()
    }

    //% subcategory="Leds apart"
    //% block="set led %num to color %color"
    //% block.loc.nl="stel led %num in op kleur %color"
    //% color.defl=Color.White
    //% num.min=1 num.max=8
    export function showLedColor(num: number, color: Color) {
        ETledRing.setPixelColor(num - 1, color)
        ETledRing.show()
    }
}
