# AGV Web V2 Design System — AMB-150

## Brand
- Primary accent: #E5364A (IndustrialNext red)
- Background: #F7F8FA → #FFFFFF gradient
- Surface cards: rgba(255,255,255,0.30) glass + blur(8px)
- Text: #2D2D2D primary, #6B7280 muted
- Status: ok #10B981, warn #F59E0B, bad #EF4444, info #3B82F6

## Typography
- UI: Inter 400/500/600/700
- Data: JetBrains Mono for coordinates, codes, metrics

## Layout
- Fixed header 56px, light glass
- Full-screen map canvas (Overview top-down OR BEV third-person)
- Floating widget cards 30% opacity, draggable, closable (no minimize)
- Component picker: left slide-in with search + 11 groups

## Overview Scene
- Light background #F7F8FA
- Map point cloud gray #8a8a8a–#b0b0b0
- LiDAR gradient near=red #EF4444, mid=yellow #F59E0B, far=black
- AGV icon red rectangle with heading arrow (AMB-150 0.572m wide)
- Stations black labels, target red ring, paths red dashed

## BEV Scene
- Same tokens, third-person orbit camera
- Layer toggles as floating card
- No dark theme

## Map Manager Banner
- Top center pill: preload blue, warning amber, mismatch red
- Map source label bottom-left on canvas

## Components (72+)
Groups: AGV, Navigation, Motion, Perception, Camera, Vision, Arm, Chassis, System, Alerts, Debug(admin)
