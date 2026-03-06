/*
File:      github.com/ETmbit/sumo-pro.ts
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

///////////////////
//  INCLUDE      //
//  px-distance  //
///////////////////

namespace PxDistance {

    export class Device {

        trigger: DigitalPin
        echo: DigitalPin

        constructor(port: RJPort) {
            this.echo = Nezha.digitalPin(port, RJLine.LA)
            this.trigger = Nezha.digitalPin(port, RJLine.LB)
        }

        read(): number {
            pins.setPull(this.trigger, PinPullMode.PullNone)
            pins.digitalWritePin(this.trigger, 0)
            control.waitMicros(2)
            pins.digitalWritePin(this.trigger, 1)
            control.waitMicros(10)
            pins.digitalWritePin(this.trigger, 0)

            // read pulse
            let d = pins.pulseIn(this.echo, PulseValue.High, 25000)
            let version = control.hardwareVersion()
            let distance = d * 34 / 2 / 1000
            if (version == "1")
                distance = distance * 3 / 2

            if (distance == 0 || distance > 430)
                return 999

            return Math.floor(distance)
        }
    }

    export function create(port: RJPort): Device {
        let device = new Device(port)
        return device
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
let ETsensorDist = PxDistance.create(RJPort.J4)

NezhaBrick.setServoType(ServoPort.S4, ServoType.ST360)
NezhaBrick.servoAngle(ServoPort.S4, 180)

enum WaitFor {
    //% block="traced"
    //% block.loc.nl="gevonden"
    Traced,
    //% block="far away"
    //% block.loc.nl="ver weg"
    Far,
    //% block="near"
    //% block.loc.nl="dichtbij"
    Near
}

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

enum FloorPos {
    Field,
    Border,
    Out
}

// pre-declared in ETmbit/match
showHandler = () => {
    if (ETplayer == Player.Green)
        ETledRing.setColor(Color.Green)
    else
        ETledRing.setColor(Color.Blue)
    ETledRing.show()
}

// pre-declared in ETmbit/match
freezeHandler = () => {
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

basic.forever(function () {
    if (!Match.isPlaying()) return
    if (ETsensorOOF.read() != Track.OffTrack) {
        ETledRing.setColor(Color.Red)
        ETledRing.show()
        freezeHandler()
        if (ETplayer == Player.Green) {
            General.sendRadioMessage("MA", MatchMessage.PointBlue)
            ETpointsBlue += 1
        }
        else {
            General.sendRadioMessage("MA", MatchMessage.PointGreen)
            ETpointsGreen += 1
        }
    }
    else
        if (ETsensorBOF.read() != Track.OffTrack) {
            ETledRing.setColor(Color.Magenta)
            ETledRing.show()
        }
        else
            showHandler()
})

//% color="#00CC00" icon="\uf0c1"
//% block="Sumo"
//% block.loc.nl="Sumo"
namespace Sumo {

    let fielddiameter = 120 // cm

    export function setFieldDiameter(diameter: number) {
        fielddiameter = diameter
    }

    export function defOut(): FloorPos {
        return FloorPos.Out
    }

    export function defBorder(): FloorPos {
        return FloorPos.Border
    }

    export function defField(): FloorPos {
        return FloorPos.Field
    }

    export function readFloorPos(): FloorPos {
        if (ETsensorOOF.read() != Track.OffTrack)
            return FloorPos.Out
        if (ETsensorBOF.read() != Track.OffTrack)
            return FloorPos.Border
        return FloorPos.Field
    }

    export function readDistance(): number {
        return ETsensorDist.read()
    }

    export function waitOpponent(waitfor: WaitFor) {
        let cm: number
        switch (waitfor) {
            case WaitFor.Traced:
                do {
                    if (!Match.isPlaying()) return
                } while (ETsensorDist.read() < fielddiameter)
                break
            case WaitFor.Far:
                do {
                    if (!Match.isPlaying()) return
                    cm = ETsensorDist.read()
                } while (cm < fielddiameter && cm > 10)
            case WaitFor.Near:
                do {
                    if (!Match.isPlaying()) return
                    cm = ETsensorDist.read()
                } while (ETsensorDist.read() < 10)
        }
    }

    export function waitFloor(floorpos: FloorPos) {
        switch (floorpos) {
            case FloorPos.Field:
                do {
                    if (!Match.isPlaying()) return
                } while (ETsensorBOF.isOffTrack())
                break
            case FloorPos.Border:
                do {
                    if (!Match.isPlaying()) return
                } while (!ETsensorBOF.isOffTrack())
                break
            case FloorPos.Out:
                do {
                    if (!Match.isPlaying()) return
                } while (!ETsensorOOF.isOffTrack())
                break
        }
    }

    export function leverDown() {
        NezhaBrick.servoAngle(ServoPort.S4, 180)
    }

    export function leverUp() {
        NezhaBrick.servoAngle(ServoPort.S4, 210)
    }

    export function turn(rotation: Rotate, speed: number) {
        if (rotation == Rotate.Clockwise)
            NezhaBrick.twoWheelSpeed(-speed / 2, speed / 2)
        else
            NezhaBrick.twoWheelSpeed(speed / 2, -speed / 2)
    }

    export function move(dir: Move, speed: number, bend: Bend) {
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
        NezhaBrick.twoWheelSpeed(0, 0)
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
