export const ROWBOAT = Object.freeze({ id:'rowboat', name:'Wooden rowboat', description:'A quiet beginning, one stroke at a time.', maxSpeed:2.1, reverseSpeed:1, acceleration:1.25, reverseAcceleration:1, coastDrag:.5, brakeDrag:4, lateralDrag:4.5, turnRate:1.05, cruiseSpeed:1.6, interior:'#ae7847', floor:['#a06b3e','#bd8a56'], trim:'#77502f', modelScale:[1,1,1] });
export const BOATS = Object.freeze([
  Object.freeze({
    id: "skiff", name: "Tide skiff", description: "Light, nimble, and easy to explore in.",
    maxSpeed: 6.2, reverseSpeed: 2.2, acceleration: 3.1, reverseAcceleration: 2.5,
    coastDrag: 0.62, brakeDrag: 5.5, lateralDrag: 4.5, turnRate: 1.18, cruiseSpeed: 4.6,
    interior: "#12ba8b", floor: ["#1cbb92", "#16ad87"], trim: "#13bc89", modelScale: [1, 1, 1],
  }),
  Object.freeze({
    id: "runabout", name: "Reef runner", description: "A quick runabout with a wider turning arc.",
    maxSpeed: 8.4, reverseSpeed: 2.8, acceleration: 4.3, reverseAcceleration: 2.8,
    coastDrag: 0.46, brakeDrag: 5.8, lateralDrag: 3.8, turnRate: 0.98, cruiseSpeed: 6.0,
    interior: "#327fbe", floor: ["#c6b28b", "#bba57e"], trim: "#297ba8", modelScale: [0.96, 1, 1.04],
  }),
  Object.freeze({
    id: "workboat", name: "Harbour launch", description: "A steady shaded launch with gentle handling.",
    maxSpeed: 4.8, reverseSpeed: 1.8, acceleration: 2.4, reverseAcceleration: 2.0,
    coastDrag: 0.78, brakeDrag: 5.2, lateralDrag: 5.4, turnRate: 0.91, cruiseSpeed: 3.5,
    interior: "#d39c62", floor: ["#be8650", "#b67b49"], trim: "#b76346", modelScale: [1.04, 1, 1],
  }),
]);

export function boatProfile(id) {
  if(id==='rowboat')return ROWBOAT;
  return BOATS.find((boat) => boat.id === id) ?? BOATS[0];
}
