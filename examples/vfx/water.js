app.configure([
  {
    key: 'image',
    type: 'file',
    kind: 'texture',
    label: 'Image'
  }
])

const particles = app.create('particles', {
  shape: ['cone', 0.2, 1, 0],
  direction: 0.1,         // Some randomization in initial direction
  rate: 100,               // 50 particles per second
  duration: 10,           // Emit for 10 seconds
  loop: true,
  
  // Initial particle properties
  life: '3',            // Random lifetime between 2-3 seconds
  speed: '6',         // Random initial speed
  size: '0.4~1',          // Random size
  color: '#228ce6~#47abff',     // Color gradient from blue to cyan
  alpha: '1',
  lit: false,
  
  // Apply gravity
  force: new Vector3(0, -9.81, 0),         // Downward force

  // speedOverLife: '0,10|1,1',
  // colorOverLife: '0,blue|1,cyan',
  
  // Rendering settings
  blending: 'normal',
  image: '/particle.png',
  image: props.image?.url,
  space: 'world',
})
app.add(particles)
particles.rotation.x = 0.5
particles.position.y =1 


// const particles = app.create('particles', {
//   shape: ['point'],
//   direction: 0.2,         // Some randomization in initial direction
//   rate: 50,               // 50 particles per second
//   duration: 10,           // Emit for 10 seconds
//   loop: true,
  
//   // Initial particle properties
//   life: '2~3',            // Random lifetime between 2-3 seconds
//   speed: '10~15',         // Random initial speed
//   size: '0.5~1',          // Random size
//   color: 'blue-cyan',     // Color gradient from blue to cyan
  
//   // Apply gravity
//   force: new Vector3(0, -9.81, 0),         // Downward force

//   // speedOverLife: '0,10|1,1',
//   colorOverLife: '0,blue|1,cyan',
  
//   // Rendering settings
//   blending: 'additive',
//   image: '/particle.png',
//   space: 'world',
// })
// app.add(particles)
// particles.position.y =1 





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