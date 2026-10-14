// Shared GLSL used by world point/line materials. Two point variants are
// provided so worlds can pick whichever fits their height axis convention.

export const POINTS_VERTEX_CREST_Z = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uPointSizeFactor;
  uniform float uCrestLow;
  uniform float uCrestHigh;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    vHeight = position.z;
    float crestBoost = smoothstep(uCrestLow, uCrestHigh, vHeight);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (uPointSizeFactor / vDepth) * uPixelRatio * (0.6 + crestBoost * 0.9);
  }
`

export const POINTS_FRAGMENT_CREST = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uDepthNear;
  uniform float uDepthFar;
  uniform float uAlphaBase;
  uniform float uAlphaCrest;
  uniform float uCrestLow;
  uniform float uCrestHigh;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    float depthFade = mix(1.0, 0.05, smoothstep(uDepthNear, uDepthFar, vDepth));
    float crestBoost = smoothstep(uCrestLow, uCrestHigh, vHeight);
    float colorBoost = 0.5 + crestBoost * 0.6;
    float alpha = sprite.a * (uAlphaBase + crestBoost * uAlphaCrest) * depthFade;
    vec3 rgb = uColor * colorBoost * (0.45 + 0.55 * depthFade);
    gl_FragColor = vec4(rgb, alpha);
  }
`

export const POINTS_VERTEX_HEIGHT_Y = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uPointSizeFactor;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    vHeight = position.y;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (uPointSizeFactor / vDepth) * uPixelRatio * (0.95 + smoothstep(-1.1, 2.8, vHeight) * 0.48);
  }
`

export const POINTS_FRAGMENT_DEPTH = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uDepthNear;
  uniform float uDepthFar;
  uniform float uAlphaBase;
  uniform float uAlphaCrest;
  varying float vDepth;
  varying float vHeight;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    float depthFade = mix(1.0, 0.06, smoothstep(uDepthNear, uDepthFar, vDepth));
    float nearFade = smoothstep(1.0, 2.8, vDepth);
    float heightBoost = smoothstep(-0.6, 2.8, vHeight);
    float alpha = sprite.a * (uAlphaBase + heightBoost * uAlphaCrest) * depthFade * nearFade * 1.25;
    gl_FragColor = vec4(uColor * (0.72 + depthFade * 0.42), alpha);
  }
`

export const GLOW_VERTEX = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uPointSizeFactor;
  varying float vDepth;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (uPointSizeFactor / vDepth) * uPixelRatio;
  }
`

export const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uDepthNear;
  uniform float uDepthFar;
  varying float vDepth;
  void main() {
    vec4 sprite = texture2D(uMap, gl_PointCoord);
    float depthFade = mix(1.0, 0.02, smoothstep(uDepthNear, uDepthFar, vDepth));
    float nearFade = smoothstep(1.2, 3.5, vDepth);
    float alpha = sprite.a * 0.3 * depthFade * nearFade;
    gl_FragColor = vec4(uColor, alpha);
  }
`
