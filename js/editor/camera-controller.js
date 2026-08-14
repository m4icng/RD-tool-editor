export class CameraController {
  constructor(element) {
    this.element = element;
    this.zoom = 1;
  }

  setZoom(value) {
    this.zoom = Math.min(2, Math.max(0.5, value));
    this.element.style.transform = `scale(${this.zoom})`;
    this.element.style.transformOrigin = "center";
  }

  reset() { this.setZoom(1); }
}
