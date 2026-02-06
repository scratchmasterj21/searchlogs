# Bulk Search Access - Quick Reference Guide

## 🚀 Quick Start (3 Steps)

1. **Select** - Check devices you want to update
2. **Open Panel** - Click "Bulk Search Access" button
3. **Execute** - Choose "Allow" or "Block" → Confirm

## 📋 Common Tasks

### ✅ Enable Search for Multiple Devices
```
1. Find devices using search/filter
2. Check the devices (or Select All)
3. Click "Bulk Search Access (X)"
4. Click green "Allow Search Access" button
5. Confirm in dialog
✓ Done!
```

### 🚫 Block Search for Multiple Devices
```
1. Find devices using search/filter
2. Check the devices (or Select All)
3. Click "Bulk Search Access (X)"
4. Click red "Block Search Access" button
5. Confirm in dialog
✓ Done!
```

### 🎯 Select All Except a Few
```
1. Apply search filter
2. Click header checkbox (Select All)
3. Uncheck devices you want to exclude
4. Click "Bulk Search Access (X)"
5. Choose action → Confirm
✓ Done!
```

## 🎨 Visual Guide

### Where to Find Everything

```
┌─────────────────────────────────────────┐
│ Device Management                       │
│ [Search box] [Sort] [Order]            │
└─────────────────────────────────────────┘
         ↓ (when devices selected)
┌─────────────────────────────────────────┐
│ ✓ 5 selected | 3 allowed • 2 blocked   │← SELECTION BAR
│ [Clear] [Bulk Search Access (5)]       │← MAIN BUTTON
└─────────────────────────────────────────┘
         ↓ (click button)
┌─────────────────────────────────────────┐
│ 🔐 Bulk Search Access Control          │← CONTROL PANEL
│ Stats: 5 devices, 3 allowed, 2 blocked │
│ [🟢 Allow (2)] [🔴 Block (3)]          │← ACTION BUTTONS
└─────────────────────────────────────────┘
         ↓ (below)
┌─────────────────────────────────────────┐
│ [☑] Device ID | Name | Status | Access │← TABLE WITH CHECKBOXES
│ [☑] device_1  | iPad | Named  | 🟢 On  │
│ [☐] device_2  | iPhn | Named  | 🔴 Off │
└─────────────────────────────────────────┘
```

### Button States

| Button | State | Meaning |
|--------|-------|---------|
| 🟢 Green (enabled) | Clickable | Can allow X blocked devices |
| 🔴 Red (enabled) | Clickable | Can block X allowed devices |
| ⚪ Gray (disabled) | Not clickable | No devices to change |

## ⚡ Keyboard/Mouse Tips

- **Select All:** Click checkbox in table header
- **Select One:** Click checkbox in device row
- **Unselect:** Click checked checkbox again
- **Clear All:** Click "Clear Selection" button

## ⚠️ Important Notes

✅ **Safe**
- Only selected devices affected
- Confirmation required
- Shows exact count before action
- Can't accidentally change wrong devices

⚠️ **Remember**
- Selection clears after successful action
- Filter changes may clear some selections
- Must have selection to use bulk actions
- Buttons disabled if no changes possible

## 🔍 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Button grayed out | Select devices first |
| "No devices selected" | Check at least one checkbox |
| Selection disappeared | Normal when filter changes |
| Can't click Allow | All selected already allowed |
| Can't click Block | All selected already blocked |

## 💡 Pro Tips

1. **Filter First** → Then select → More efficient
2. **Check Stats** → Selection bar shows breakdown
3. **Start Small** → Test with 2-3 devices first
4. **Use Wisely** → Read confirmation dialogs

## 📞 Need Help?

- Check main documentation: `BULK_SEARCH_ACCESS_FEATURE.md`
- Look for blue highlights on selected rows
- Read button labels - they show counts
- Check selection summary bar for stats

---

**TL;DR:** Check boxes → Click orange button → Choose action → Confirm → Done! 🎉
