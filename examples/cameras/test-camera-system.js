/**
 * Simple Camera System Test
 * 
 * This test verifies that the camera system works without toPxVec3 errors
 */

console.log('🎥 Testing Camera System...')

// Test 1: Check if THREE.Vector3 has toPxVec3 method
if (typeof THREE !== 'undefined' && THREE.Vector3) {
  const testVec = new THREE.Vector3(1, 2, 3)
  if (typeof testVec.toPxVec3 === 'function') {
    console.log('✅ THREE.Vector3.toPxVec3 method is available')
  } else {
    console.log('❌ THREE.Vector3.toPxVec3 method is NOT available')
  }
} else {
  console.log('❌ THREE.js not available')
}

// Test 2: Check if world.camera is available
if (world.camera) {
  console.log('✅ World camera is available')
} else {
  console.log('❌ World camera is NOT available')
}

// Test 3: Check if CameraManager is available
if (world.cameraManager) {
  console.log('✅ CameraManager is available')
} else {
  console.log('❌ CameraManager is NOT available')
}

// Test 4: Check if physics extensions are loaded
if (typeof PHYSX !== 'undefined') {
  console.log('✅ PhysX is loaded')
} else {
  console.log('❌ PhysX is NOT loaded')
}

// Test 5: Try to create a simple camera
try {
  const testCamera = app.create('camera', {
    name: 'test-camera',
    position: [0, 1.6, 5],
    active: false,
    showHelper: true
  })
  
  if (testCamera) {
    console.log('✅ Camera creation successful')
    
    // Test camera activation
    if (world.cameraManager) {
      world.cameraManager.setActiveCamera(testCamera)
      console.log('✅ Camera activation successful')
    } else {
      console.log('❌ CameraManager not available for activation')
    }
  } else {
    console.log('❌ Camera creation failed')
  }
} catch (error) {
  console.log('❌ Camera creation error:', error.message)
}

// Test 6: Check if simpleCamLerp is available
if (typeof simpleCamLerp === 'function') {
  console.log('✅ simpleCamLerp function is available')
} else {
  console.log('❌ simpleCamLerp function is NOT available')
}

console.log('🎥 Camera System Test Complete!')