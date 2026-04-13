#!/bin/bash
# Email Filter Monitor Script
# For monitoring and troubleshooting Gmail filters

echo "📧 EMAIL FILTER MONITOR"
echo "========================"
echo ""
echo "This script helps track email filter issues."
echo ""

# Create log directory if it doesn't exist
LOG_DIR="$HOME/.openclaw/workspace/logs/email-filters"
mkdir -p "$LOG_DIR"

# Current date for logging
CURRENT_DATE=$(date +"%Y-%m-%d")
LOG_FILE="$LOG_DIR/filter-check-$CURRENT_DATE.log"

echo "Logging to: $LOG_FILE"
echo ""

# Check if we have any previous Airbnb filter issues
if [ -f "$LOG_DIR/last-airbnb-issue.log" ]; then
    echo "📋 Previous Airbnb filter issues found:"
    cat "$LOG_DIR/last-airbnb-issue.log"
    echo ""
fi

# Log current check
echo "=== Filter Check $(date) ===" >> "$LOG_FILE"
echo "Checking for Airbnb filter issues..." >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Create a reminder for manual check
echo "🔔 REMINDER FOR MANUAL GMAIL CHECK:" | tee -a "$LOG_FILE"
echo "1. Open Gmail → Settings → Filters and Blocked Addresses" | tee -a "$LOG_FILE"
echo "2. Look for Airbnb filters" | tee -a "$LOG_FILE"
echo "3. Check if they're enabled and working" | tee -a "$LOG_FILE"
echo "4. Test with 'Filter messages like these' on an existing Airbnb email" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Suggested filter rules
echo "🎯 SUGGESTED FILTER RULES:" | tee -a "$LOG_FILE"
echo "1. From: *@airbnb.com → Delete" | tee -a "$LOG_FILE"
echo "2. From: *@airbnb.se → Delete" | tee -a "$LOG_FILE"
echo "3. From: *@airbnb.co.uk → Delete" | tee -a "$LOG_FILE"
echo "4. From: *@airbnb.fr → Delete" | tee -a "$LOG_FILE"
echo "5. Subject contains: Airbnb → Delete" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Create a simple checklist file
CHECKLIST_FILE="$LOG_DIR/checklist.md"
cat > "$CHECKLIST_FILE" << EOF
# Gmail Filter Checklist

## Monthly Check
- [ ] Open Gmail Settings → Filters
- [ ] Verify Airbnb filters exist and are enabled
- [ ] Test with existing Airbnb email
- [ ] Check trash folder for recent Airbnb emails

## Filter Rules to Maintain
1. \`*@airbnb.com\` → Delete
2. \`*@airbnb.se\` → Delete
3. \`*@airbnb.co.uk\` → Delete
4. \`*@airbnb.fr\` → Delete
5. Subject contains "Airbnb" → Delete

## Troubleshooting Steps
1. If filters don't work:
   - Check filter is enabled (green toggle)
   - Use "Filter messages like these" on existing email
   - Check for conflicting filters
   - Try broader pattern: \`*@airbnb.*\`

2. If emails go to spam instead:
   - Mark as "Not spam"
   - Create filter that overrides spam classification

## Last Check: $(date)
## Next Check: $(date -d "+30 days" +"%Y-%m-%d")
EOF

echo "✅ Checklist created: $CHECKLIST_FILE"
echo "📊 Log updated: $LOG_FILE"
echo ""
echo "To set up automatic reminders:"
echo "1. Add this script to cron: crontab -e"
echo "2. Add line: 0 9 * * 1 $HOME/.openclaw/workspace/scripts/email-filter-monitor.sh"
echo "   (Runs every Monday at 9 AM)"
echo ""
echo "For immediate fix, follow the guide in:"
echo "$HOME/.openclaw/workspace/airbnb-filter-fix-guide.md"