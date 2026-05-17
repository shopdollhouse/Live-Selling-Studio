import { bootstrapCameraKit, createMediaStreamSource, Transform2D } from "@snap/camera-kit";

window.SnapCameraKitBridge = {
  bootstrapCameraKit,
  createMediaStreamSource,
  Transform2D,
};

window.dispatchEvent(new CustomEvent("snap-camera-kit-ready"));
