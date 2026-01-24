app.configure([
	{
		key: 'image',
		type: 'file',
		kind: 'texture',
		label: 'Image'
	}
])


const particles = app.create('particles', {
	image: props.image?.url,
	shape: ['hemisphere', 2, 0, true],
	direction: 0,
	rate: 10,
	// bursts: [
	//   { time: 0, count: 100 },
	//   { time: 0.5, count: 500 },
	//   { time: 1, count: 10000 },
	// ],
	spritesheet: [2, 4, 16, false],
	duration: 5,
	// loop: false,
	// timescale: 0.1,
	max: 10000,
	space: 'world',
	life: '0.5',
	speed: '0.1',
	size: '1',
	// rotate: '0~360',
	// color: 'blue',
	alpha: '1',
	// emissive: '10',
	lit: false,
	blending: 'normal',
	// onEnd: () => { 
	//   console.log('END')
	//   world.remove(particles)
	// }
})
app.add(particles)
particles.position.y = 1





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