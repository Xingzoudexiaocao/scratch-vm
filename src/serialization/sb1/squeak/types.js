class PointData extends fieldData({
    X: 0,
    Y: 1
}) {}

class RectangleData extends fieldData({
    X: 0,
    Y: 1,
    X2: 2,
    Y2: 3
}) {
    get width () {
        return this.x2 - this.x;
    }

    get height () {
        return this.y2 - this.y;
    }
}

const _bgra2rgbaInPlace = uint8 => {
    for (let i = 0; i < uint8.length; i += 4) {
        const r = uint8[i + 2];
        const b = uint8[i + 0];
        uint8[i + 2] = b;
        uint8[i + 0] = r;
    }
    return uint8;
};

class ImageData extends fieldData({
    WIDTH: 0,
    HEIGHT: 1,
    DEPTH: 2,
    SOMETHING: 3,
    BYTES: 4,
    COLORMAP: 5
}) {
    get png () {
        if (!this._png) {
            this._png = new Uint8Array(PNGFile.encode(
                this.width,
                this.height,
                _bgra2rgbaInPlace(new Uint8Array(
                    new SqueakImageDecoder().decode(
                        this.width.value,
                        this.height.value,
                        this.depth.value,
                        this.bytes.value,
                        this.colormap && this.colormap.map(color => color.valueOf())
                    ).buffer
                ))
            ));
        }
        return this._png;
    }

    get preview () {
        const image = new Image();
        image.src = URL.createObjectURL(
            new Blob([this.png.buffer], { type: 'image/png' })
        );
        return image;
    }
}

class StageData extends fieldData({
    STAGE_CONTENTS: 2,
    OBJ_NAME: 6,
    VARS: 7,
    BLOCKS_BIN: 8,
    IS_CLONE: 9,
    MEDIA: 10,
    CURRENT_COSTUME: 11,
    ZOOM: 12,
    H_PAN: 13,
    V_PAN: 14,
    OBSOLETE_SAVED_STATE: 15,
    SPRITE_ORDER_IN_LIBRARY: 16,
    VOLUME: 17,
    TEMPO_BPM: 18,
    SCENE_STATES: 19,
    LISTS: 20
}) {
    get spriteOrderInLibrary () {
        return this.fields[this.FIELDS.SPRITE_ORDER_IN_LIBRARY] || null;
    }

    get tempoBPM () {
        return this.fields[this.FIELDS.TEMPO_BPM] || 0;
    }

    get lists () {
        return this.fields[this.FIELDS.LISTS] || [];
    }
}

class SpriteData extends fieldData({
    BOX: 0,
    PARENT: 1,
    COLOR: 3,
    VISIBLE: 4,
    OBJ_NAME: 6,
    VARS: 7,
    BLOCKS_BIN: 8,
    IS_CLONE: 9,
    MEDIA: 10,
    CURRENT_COSTUME: 11,
    VISIBILITY: 12,
    SCALE_POINT: 13,
    ROTATION_DEGREES: 14,
    ROTATION_STYLE: 15,
    VOLUME: 16,
    TEMPO_BPM: 17,
    DRAGGABLE: 18,
    SCENE_STATES: 19,
    LISTS: 20
}) {
    get scratchX () {
        return this.box.x + this.currentCostume.rotationCenter.x - 240;
    }

    get scratchY () {
        return 180 - (this.box.y + this.currentCostume.rotationCenter.y);
    }

    get visible () {
        return (this.fields[this.FIELDS.VISIBLE] & 1) === 0;
    }

    get tempoBPM () {
        return this.fields[this.FIELDS.TEMPO_BPM] || 0;
    }

    get lists () {
        return this.fields[this.FIELDS.LISTS] || [];
    }
}

class TextDetailsData extends fieldData({
    RECTANGLE: 0,
    FONT: 8,
    COLOR: 9,
    LINES: 11
}) {}

class ImageMediaData extends fieldData({
    COSTUME_NAME: 0,
    BITMAP: 1,
    ROTATION_CENTER: 2,
    TEXT_DETAILS: 3,
    BASE_LAYER_DATA: 4,
    OLD_COMPOSITE: 5
}) {
    get bytes () {
        if (this.oldComposite instanceof ImageData) {
            return this.oldComposite.png;
        }
        if (this.baseLayerData.value) {
            return this.baseLayerData.value;
        }
        return this.bitmap.png;
    }

    get crc () {
        if (!this._crc) {
            const crc = new CRC32()
            .update(new Uint8Array(new Uint32Array([this.bitmap.width]).buffer))
            .update(new Uint8Array(new Uint32Array([this.bitmap.height]).buffer))
            .update(new Uint8Array(new Uint32Array([this.bitmap.depth]).buffer))
            .update(this.bytes);
            this._crc = crc.digest;
        }
        return this._crc;
    }

    get extension () {
        if (this.oldComposite instanceof ImageData) return 'png';
        if (this.baseLayerData.value) return 'jpg';
        return 'png';
    }

    get preview () {
        if (this.oldComposite instanceof ImageData) {
            return this.oldComposite.preview;
        }
        if (this.baseLayerData.value) {
            const image = new Image();
            image.src = URL.createObjectURL(new Blob([this.baseLayerData.value], {type: 'image/jpeg'}));
            return image;
        }
        return this.bitmap.preview;
    }

    toString () {
        return `ImageMediaData "${this.costumeName}"`;
    }
}

class UncompressedData extends fieldData({
    DATA: 3,
    RATE: 4,
}) {}

const reverseBytes16 = input => {
    const uint8 = new Uint8Array(input);
    for (let i = 0; i < uint8.length; i += 2) {
        uint8[i] = input[i + 1];
        uint8[i + 1] = input[i];
    }
    return uint8;
};

class SoundMediaData extends fieldData({
    NAME: 0,
    UNCOMPRESSED: 1,
    RATE: 4,
    BITS_PER_SAMPLE: 5,
    DATA: 6
}) {
    get rate () {
        if (this.uncompressed.data.value.length !== 0) {
            return this.uncompressed.rate;
        }
        return this.fields[this.FIELDS.RATE];
    }

    get bytes () {
        if (!this._wav) {
            let samples;
            if (this.data && this.data.value) {
                samples = new SqueakSoundDecoder(this.bitsPerSample.value).decode(
                    this.data.value
                );
            } else {
                samples = new Int16Array(reverseBytes16(this.uncompressed.data.value.slice()).buffer);
            }

            this._wav = new Uint8Array(WAVFile.encode(samples, {
                sampleRate: this.rate && this.rate.value || this.uncompressed.rate.value
            }));
        }

        return this._wav;
    }

    get crc () {
        if (!this._crc) {
            this._crc = new CRC32().update(this.bytes).digest;
        }
        return this._crc;
    }

    get sampleCount () {
        return WAVFile.samples(this.bytes);
    }

    get preview () {
        const audio = new Audio();
        audio.controls = true;

        audio.src = URL.createObjectURL(
            new Blob([this.bytes.buffer],{ type: 'audio/wav' })
        );
        return audio;
    }

    toString () {
        return `SoundMediaData "${this.name}"`;
    }
}

class ListWatcherData extends fieldData({
    BOX: 0,
    HIDDEN_WHEN_NULL: 1,
    LIST_NAME: 8,
    CONTENTS: 9,
    TARGET: 10
}) {
    get x () {
        if (value(this.hiddenWhenNull) === null) return 5;
        return this.box.x + 1;
    }

    get y () {
        if (value(this.hiddenWhenNull) === null) return 5;
        return this.box.y + 1;
    }

    get width () {
        return this.box.width - 2;
    }

    get height () {
        return this.box.height - 2;
    }
}

class AlignmentData extends fieldData({
    BOX: 0,
    PARENT: 1,
    FRAMES: 2,
    COLOR: 3,
    DIRECTION: 8,
    ALIGNMENT: 9
}) {}

class MorphData extends fieldData({
    BOX: 0,
    PARENT: 1,
    COLOR: 3
}) {}

class StaticStringData extends fieldData({
    BOX: 0,
    COLOR: 3,
    VALUE: 8,
}) {}

class UpdatingStringData extends fieldData({
    BOX: 0,
    READOUT_FRAME: 1,
    COLOR: 3,
    FONT: 6,
    VALUE: 8,
    TARGET: 10,
    CMD: 11,
    PARAM: 13
}) {}

class WatcherReadoutFrameData extends fieldData({
    BOX: 0,
}) {}

const WATCHER_MODES = {
    NORMAL: 1,
    LARGE: 2,
    SLIDER: 3,
    TEXT: 4
};

class WatcherData extends fieldData({
    BOX: 0,
    TARGET: 1,
    SHAPE: 2,
    READOUT: 14,
    READOUT_FRAME: 15,
    SLIDER: 16,
    ALIGNMENT: 17,
    SLIDER_MIN: 20,
    SLIDER_MAX: 21
}) {
    get x () {
        return this.box.x;
    }

    get y () {
        return this.box.y;
    }

    get mode () {
        if (value(this.slider) === null) {
            if (this.readoutFrame.box.height <= 14) {
                return WATCHER_MODES.NORMAL;
            }
            return WATCHER_MODES.LARGE;
        }
        return WATCHER_MODES.SLIDER;
    }

    get isDiscrete () {
        return (
            Math.floor(this.sliderMin) === this.sliderMin &&
            Math.floor(this.sliderMax) === this.sliderMax &&
            Math.floor(this.readout.value) === this.readout.value
        );
    }
}

const EXTENDED_CONSTRUCTORS = {
    [TYPES.POINT]: PointData,
    [TYPES.RECTANGLE]: RectangleData,
    [TYPES.FORM]: ImageData,
    [TYPES.SQUEAK]: ImageData,
    [TYPES.SAMPLED_SOUND]: UncompressedData,
    [TYPES.SPRITE]: SpriteData,
    [TYPES.STAGE]: StageData,
    [TYPES.IMAGE_MEDIA]: ImageMediaData,
    [TYPES.SOUND_MEDIA]: SoundMediaData,
    [TYPES.ALIGNMENT]: AlignmentData,
    [TYPES.MORPH]: MorphData,
    [TYPES.WATCHER_READOUT_FRAME]: WatcherReadoutFrameData,
    [TYPES.STATIC_STRING]: StaticStringData,
    [TYPES.UPDATING_STRING]: UpdatingStringData,
    [TYPES.WATCHER]: WatcherData,
    [TYPES.LIST_WATCHER]: ListWatcherData
};
