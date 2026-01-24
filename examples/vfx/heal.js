app.configure([
  {
    key: 'image',
    type: 'file',
    kind: 'texture',
    label: 'Image'
  },
  {
    key: 'image2',
    type: 'file',
    kind: 'texture',
    label: 'Image2'
  }
])


const dots = app.create('particles', {
  image: props.image?.url,
  shape: ['circle', 2, 1],
  direction: 1,
  speed: '1',
  size: '0.03',
  rate: 30,
  life: '4',
  // blending: 'additive',
  // alpha: '0.8',
  emissive: '100',
  // alpha: '0.01~0.03',
  // size: '5',
  // rotate: '0~360',
  color: 'green',
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
  velocityOrbital: new Vector3(0, 0.2, 0),
  velocityLinear: new Vector3(0, 1, 0),
  // velocityRadial: -0.1

})
app.add(dots)

const lines = app.create('particles', {
  image: props.image2?.url,
  shape: ['circle', 2, 1],
  // direction: 1,
  speed: '2',
  size: '0.8',
  rate: 10,
  life: '2',
  blending: 'additive',
  alpha: '0.4',
  emissive: '100',
  // alpha: '0.01~0.03',
  // size: '5',
  // rotate: '0~360',
  color: 'green',
  alphaOverLife: '0,0|0.5,1|0.5,1|1,0',
  // velocityOrbital: new Vector3(0, 0.2, 0),
  // velocityLinear: new Vector3(0, 1, 0),
  // velocityRadial: -0.1
})
app.add(lines)





// function spawn() {
//   const particles = app.create('particles', {
//     shape: ['box', 1, 50, 1, 1, 'volume', true],
//     direction: 0,
//     rate: 1000,
//     // bursts: [
//     //   { time: 0, count: 100 },
//     //   { time: 0.5, count: 500 },
//     //   { time: 1, count: 10000 },
//     // ],
//     duration: 5,
//     // loop: false,
//     max: 10000,
//     space: 'world',
//     life: '5',
//     speed: '0.1',
//     size: '1',
//     rotate: '0~360',
//     // color: 'blue',
//     alpha: '1',
//     // emissive: '10',
//     lit: false,
//     blending: 'normal'
//   })
//   particles.position.set(num(-100, 100, 2), 0, num(-100, 100, 2))
//   world.add(particles)
//   setTimeout(()=> {
//     world.remove(particles)
//   }, 3000)
// }

// let elapsed = 0
// app.on('update', delta => {
//   elapsed += delta
//   if (elapsed > 0.1) {
//     elapsed = 0
//     spawn()
//     spawn()
//   }
// })