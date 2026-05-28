# Cockpit Task Manager

A htop-like process and system resource monitoring plugin for Cockpit, supporting CPU, memory, disk, network, and GPU monitoring.

## Features

### Dashboard
- CPU, memory, swap usage overview with mini sparkline charts
- CPU and memory usage history (dual-line chart)
- Top 10 processes by CPU usage

### Processes
- Full process list with configurable columns (18 columns available)
- Column drag-reorder and visibility toggle (settings panel)
- Real-time IO rate (bytes/sec) for top 30 processes
- Click row for process detail popup (PID, PPID, user, threads, IO, etc.)
- Expandable child/parent process tree in detail popup
- Kill process from detail popup
- Search/filter processes by name, PID, or user
- Sort by any column (PID, CPU%, MEM%, RSS, command, etc.)

### CPU
- Per-core usage bars and frequency
- Temperature, power draw (RAPL)
- Instruction set tags (SSE, AVX, AVX-512, etc.)
- Load averages (1/5/15 min)
- CPU usage history per core

### Memory
- Physical memory usage bar with Used/Cached/Free breakdown
- Detailed stats: Dirty, Writeback, AnonPages, Mapped, Slab, KernelStack, PageTables, HugePages
- Swap usage with path, type, priority info
- Memory & swap usage history (dual-line chart)
- Memory hardware info (DDR type, channels, slots, voltage)

### Disk
- Disk usage per mount point with usage bars

### Network
- Network interface statistics (RX/TX bytes)

### GPU
- Multi-vendor support: NVIDIA (nvidia-smi), AMD (sysfs), Intel (sysfs/intel_gpu_top)
- GPU utilization, temperature, power, fan speed
- GPU memory usage
- GPU process list
- GPU usage history

## Requirements

- Cockpit >= 276
- procps, pciutils
- Recommended: lm-sensors, nvtop, intel-gpu-tools, nethogs

## Installation

### From DEB Package

```bash
# Install (dependencies will be pulled automatically)
sudo dpkg -i cockpit-taskmgr_1.4.5_all.deb
sudo apt install -f  # install missing dependencies
```

### Manual Installation

```bash
sudo mkdir -p /usr/share/cockpit/taskmgr/static/lang
sudo cp index.html manifest.json /usr/share/cockpit/taskmgr/
sudo cp static/taskmgr.css static/taskmgr.js /usr/share/cockpit/taskmgr/static/
sudo cp static/lang/*.json /usr/share/cockpit/taskmgr/static/lang/
```

## Usage

1. Open Cockpit web interface (`https://hostname:9090`)
2. Navigate to **Task Manager** in the sidebar
3. Use the menu to switch between views

### Process Page
- **Settings button** (top-right): Configure visible columns, toggle kernel threads/user processes
- **Column reorder**: Drag columns in settings panel, click Save to apply
- **Column resize**: Drag column borders in the table header
- **Detail popup**: Click any process row to see full details, child/parent processes, and kill button
- **Kill button**: Appears when processes are selected

### Settings
- Refresh interval (500ms - 5s)
- Theme color and dark mode
- Language (Chinese/English)
- Menu layout (sidebar/top bar)

## File Structure

```
cockpit-taskmgr/
├── version              # Version number
├── index.html           # Main HTML page
├── manifest.json        # Cockpit plugin manifest
├── build-deb.sh         # DEB package build script
├── static/
│   ├── taskmgr.css      # Styles
│   ├── taskmgr.js       # JavaScript logic
│   └── lang/
│       ├── en.json      # English translations
│       └── zh-CN.json   # Chinese translations
└── README.md
```

## Version

The version number is stored in the `version` file. All packaging scripts read from this file.

## License

MIT License
