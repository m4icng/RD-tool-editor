export class CameraController {
  constructor({ min = 0.5, max = 2, step = 0.1, onChange = () => {} } = {}) {
    this.min = min;
    this.max = max;
    this.step = step;
    this.onChange = onChange;
    this.zoom = 1;
  }

  setZoom(value) {
    const clamped = Math.min(this.max, Math.max(this.min, Number(value) || 1));
    this.zoom = Math.round(clamped * 100) / 100;
    this.onChange(this.zoom);
    return this.zoom;
  }

  zoomIn() { return this.setZoom(this.zoom + this.step); }

  zoomOut() { return this.setZoom(this.zoom - this.step); }

  reset() { this.setZoom(1); }
}
