export class PerlinNoise {
    constructor(seed = 42) {
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        let s = seed | 0;
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807 + 0) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }

    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    grad3(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const p = this.perm;
        const a = p[p[X] + Y];
        const b = p[p[X + 1] + Y];
        const c = p[p[X] + Y + 1];
        const d = p[p[X + 1] + Y + 1];
        return this.lerp(
            this.lerp(this.grad(a, xf, yf), this.grad(b, xf - 1, yf), u),
            this.lerp(this.grad(c, xf, yf - 1), this.grad(d, xf - 1, yf - 1), u),
            v
        );
    }

    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const zf = z - Math.floor(z);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const w = this.fade(zf);
        const p = this.perm;
        const aaa = p[p[p[X] + Y] + Z];
        const aba = p[p[p[X] + Y + 1] + Z];
        const aab = p[p[p[X] + Y] + Z + 1];
        const abb = p[p[p[X] + Y + 1] + Z + 1];
        const baa = p[p[p[X + 1] + Y] + Z];
        const bba = p[p[p[X + 1] + Y + 1] + Z];
        const bab = p[p[p[X + 1] + Y] + Z + 1];
        const bbb = p[p[p[X + 1] + Y + 1] + Z + 1];
        return this.lerp(
            this.lerp(
                this.lerp(this.grad3(aaa, xf, yf, zf), this.grad3(baa, xf - 1, yf, zf), u),
                this.lerp(this.grad3(aba, xf, yf - 1, zf), this.grad3(bba, xf - 1, yf - 1, zf), u), v),
            this.lerp(
                this.lerp(this.grad3(aab, xf, yf, zf - 1), this.grad3(bab, xf - 1, yf, zf - 1), u),
                this.lerp(this.grad3(abb, xf, yf - 1, zf - 1), this.grad3(bbb, xf - 1, yf - 1, zf - 1), u), v),
            w
        );
    }

    octave2D(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            value += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return value / maxValue;
    }

    octave3D(x, y, z, octaves = 3, persistence = 0.5, lacunarity = 2.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            value += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }
        return value / maxValue;
    }
}