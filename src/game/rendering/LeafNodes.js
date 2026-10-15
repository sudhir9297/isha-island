import { PhysicalLightingModel } from 'three/webgpu';
import { attribute, varying, materialRoughness, normalView, diffuseColor, vec3, mix, Fn, If, positionView, faceDirection } from 'three/tsl';

const surface = varying(attribute('leafSurface', 'vec2'));
const thinness = varying(attribute('leafThinness', 'float'));
const lateral = surface.x.mul(2).sub(1);
const rib = lateral.mul(lateral).mul(-85).exp();
const phase = surface.y.sub(lateral.abs().mul(0.16)).mul(150);
const detail = phase.fwidth().smoothstep(0.5, 2.5).oneMinus();
const relief = rib.mul(0.0008).add(phase.cos().mul(rib.oneMinus()).mul(detail).mul(0.00028))
  .mul(surface.y.clamp().mul(Math.PI).sin());

class LeafLightingModel extends PhysicalLightingModel {
  direct(input, builder) {
    super.direct(input, builder);
    const grazing = normalView.dot(input.lightDirection).mul(-0.5).add(0.5).clamp();
    const scatter = grazing.pow(2).mul(thinness.mul(0.82).add(0.18)).mul(0.46 / Math.PI);
    const pigment = mix(diffuseColor.rgb, vec3(0.34, 0.49, 0.16), thinness.mul(0.2));
    input.reflectedLight.directDiffuse.addAssign(input.lightColor.mul(pigment).mul(scatter));
  }
}

export function leafSurfaceNodes(wind) {
  return {
    ...wind,
    roughnessNode: materialRoughness.add(lateral.pow(2).mul(0.07))
      .sub(lateral.pow(2).mul(-30).exp().mul(0.035)).clamp(0.35, 1),
    normalNode: Fn(() => {
      const normal = wind.normalNode.mul(faceDirection).toVar();
      const dx = positionView.dFdx(), dy = positionView.dFdy();
      const r1 = dy.cross(normal), r2 = normal.cross(dx);
      const determinant = dx.dot(r1);
      If(determinant.abs().greaterThan(1e-10), () => {
        const gradient = r1.mul(relief.dFdx()).add(r2.mul(relief.dFdy())).mul(determinant.sign());
        normal.assign(normal.mul(determinant.abs()).sub(gradient).normalize());
      });
      return normal;
    })(),
    setupLightingModel: () => new LeafLightingModel(),
  };
}
