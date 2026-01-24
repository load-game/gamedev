# Realistic Depth of Field Enhancement Guide

## Overview
The depth of field (DOF) system has been enhanced to provide more realistic, cinema-quality bokeh effects that mimic real-world camera lenses.

## Key Improvements

### 1. Realistic Camera Parameters

**Before (Unrealistic):**
- fStop: 0.5 (impossible in real cameras)
- Bokeh Shape: Pentagon (artificial-looking)
- Chromatic Aberration: 1.5 (too strong)
- Autofocus Speed: 8 (unnaturally fast)
- Luminance Threshold: 0.2 (too sensitive)

**After (Realistic):**
- fStop: 1.4-2.8 (real-world range for sharp + bokeh)
- Bokeh Shape: Circular (matches actual lens aperture)
- Chromatic Aberration: 0.8 (subtle, realistic)
- Autofocus Speed: 1.0 (natural response with lag)
- Luminance Threshold: 0.6 (natural bokeh activation)

### 2. Enhanced Autofocus System

The new DOF system implements realistic autofocus behavior including:

- **Response Lag**: 80ms delay (matches real AF systems)
- **Focus Prediction**: Anticipates subject movement
- **Focus Breathing**: Lens focal length changes when focusing (0.01-0.06x)
- **Hunting Behavior**: Natural back-and-forth adjustment
- **Velocity Tracking**: Smooth focus pulls

### 3. Lens Database

Pre-configured realistic lens presets:

- **50mm f/1.4**: Portrait lens, smooth bokeh
- **85mm f/1.4**: Portrait telephoto, creamy bokeh
- **35mm f/1.8**: Wide-angle, natural rendering
- **24-70mm f/2.8**: Zoom lens, balanced character
- **135mm f/2.0**: Telephoto, compressed perspective

Each lens has unique characteristics:
- Aperture blade count (7-9 blades)
- Circle of confusion (CoC) values
- Minimum focus distance
- Focus breathing amount
- Bokeh character (smooth, creamy, natural, balanced)

### 4. Bokeh Quality Improvements

- **Smooth Falloff**: Gradual blur transition
- **Circular Aperture**: Matches real lens blades
- **Adaptive Brightness**: Bokeh responds to scene lighting
- **Reduced Artifacts**: Minimal chromatic aberration
- **Realistic Blur Radius**: Based on fStop and focal length

### 5. Depth of Field Mathematics

Realistic DOF calculations using:

```
Circle of Confusion (CoC) = lens-specific value
Near Limit = (focusDistance * fStop * CoC) / (fStop * CoC + focusDistance - fStop)
Far Limit = (focusDistance * fStop * CoC) / (fStop * CoC - focusDistance + fStop)
Hyperfocal = (focalLength²) / (fStop * CoC)
```

## Usage

### Basic Usage

The realistic DOF system works automatically with the new camera defaults:

```javascript
// Create a camera with realistic DOF
const camera = app.create('camera', {
  dof: {
    enabled: true,
    fStop: 1.8,
    focalLength: 50,
    autofocus: true
  }
})
```

### Using the Realistic DOF App

1. Load the realistic DOF app in your world:
   ```javascript
   // In your world configuration
   apps: [
     'realistic-dof-cinematic'
   ]
   ```

2. Configure via the settings panel:
   - **Lens Type**: Choose from 5 realistic presets
   - **Focus Mode**: Single-AF, Continuous-AF, Predictive-AF, or Manual
   - **Autofocus Speed**: 0.3-2.0 (lower = more realistic lag)
   - **Focus Breathing**: 0.0-0.15 (lens focal length change)
   - **Bokeh Quality**: 0.5-2.0 (smoothness of blur)

### Advanced Configuration

```javascript
// Custom lens configuration
app.create('camera', {
  dof: {
    fStop: 1.4,              // f/1.4 for shallow DOF
    focalLength: 85,         // 85mm telephoto
    maxBlur: 0.06,           // Blur intensity
    luminanceThreshold: 0.6, // Bokeh activation threshold
    luminanceGain: 2.5,      // Bokeh intensity
    bias: 0.08,              // Focus transition sharpness
    fringe: 0.8,             // Chromatic aberration
    pentagon: false,         // Use circular bokeh
    autofocus: true,
    autofocusSpeed: 1.0,     // Natural response
    autofocusSmoothness: 0.15
  }
})
```

## Testing the DOF

### Visual Test

1. Create objects at different distances
2. Enable the realistic DOF app
3. Move between first-person and third-person
4. Observe focus changes

### Debug Information

The system provides real-time debug info:
- Current focus distance
- Lens parameters
- DOF limits (near/far)
- AF state (hunting/locked)
- Focus breathing amount

### Expected Results

**Realistic Behavior:**
- Smooth focus transitions with slight lag
- Circular bokeh shapes
- Natural blur falloff
- Subtle chromatic aberration
- Focus breathing on major adjustments

**Comparisons:**
- f/1.4: Very shallow DOF, creamy bokeh
- f/2.8: Balanced DOF, sharp subject with nice blur
- f/5.6: Deep DOF, more of scene in focus

## Integration

### With Head Bone System

The realistic DOF integrates seamlessly with the existing head bone raycast system:

- Uses head position in third-person mode
- Falls back to camera center in first-person
- Provides smooth transitions between modes

### With Camera Motion

Realistic DOF works with camera motion systems:
- Motion blur integration
- Breathing affects focal length
- Smooth focus during camera movement

## Performance Considerations

- DOF runs at 480p resolution for efficiency
- Uniform updates are minimal impact
- Raycast optimization prevents excessive calculations
- Focus history limited to 10 entries

## Troubleshooting

**Issue: Bokeh looks too strong**
- Solution: Increase `luminanceThreshold` to 0.7-0.8
- Or reduce `maxBlur` to 0.04-0.05

**Issue: Focus is too jumpy**
- Solution: Increase `autofocusSmoothness` to 0.2-0.3
- Or reduce `autofocusSpeed` to 0.6-0.8

**Issue: Focus isn't changing**
- Check that DOF is enabled in camera settings
- Verify `world.prefs.dofEnabled` is true
- Ensure focus mode is not set to 'manual'

**Issue: First-person focus issues**
- The system automatically switches to camera-center raycast in FP mode
- This is intentional for stability

## Best Practices

1. **Use appropriate fStop**:
   - f/1.4-f/2.0: Portraits, shallow DOF
   - f/2.8-f/4.0: General use, balanced
   - f/5.6-f/8.0: Landscapes, deep DOF

2. **Match focal length to context**:
   - 35mm: Wide shots, environments
   - 50mm: Natural perspective, general use
   - 85mm: Portraits, compression
   - 135mm: Telephoto, compression

3. **Tune autofocus speed**:
   - 0.5-0.8: Cinematic, dramatic
   - 1.0-1.5: Natural, realistic
   - 1.5-2.0: Snappy, responsive

4. **Enable focus breathing for realism**:
   - 0.02-0.04: Subtle effect
   - 0.04-0.06: Noticeable but natural
   - 0.06+: Dramatic effect

## Future Enhancements

Potential improvements:
- Motion blur integration
- Exposure-based bokeh adaptation
- Custom aperture blade shapes
- Anamorphic bokeh simulation
- Eye tracking for portraits
- Subject distance prediction

## References

- Based on real-world lens characteristics
- Uses standard photographic formulas
- Inspired by cinema camera behavior
- Implements industry-standard AF lag times