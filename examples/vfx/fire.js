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
	shape: ['cone', 0.2, 1, 0],
	direction: 0.2,
	life: '2',
	// speed: '2',
	rate: 50,
	alpha: '0.5',
	color: 'red',
	blending: 'additive',
	size: '1',
	rotate: '0~360',
	// alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
	// velocityOrbital: new Vector3(0, 0.1, 0),
	// velocityLinear: new Vector3(0, 1, 0),
	sizeOverLife: '0,0.5|0.3,1|1,0',
	rotateOverLife: '0,0|1,45',
	colorOverLife: '0,red|0.4,orange|0.8,black'
})
app.add(particles)





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