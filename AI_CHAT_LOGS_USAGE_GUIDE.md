# AI Chat Logs - User Guide

## 🎉 What's New?

Your search logs system now includes **AI Chat Logs** tracking! You can now monitor and analyze all AI-powered conversations alongside your existing search logs.

## 🚀 Quick Start

### Accessing AI Chat Logs

1. **View AI Chat Logs**: Navigate to `/ai-chats` or click "AI Chats" in the navigation menu
2. **View AI Analytics**: Navigate to `/ai-analytics` or click "AI Analytics" from the AI Chats page

## 📊 Features Overview

### AI Chat Logs Table (`/ai-chats`)

#### Search & Filter
- **Date Range**: Select from/to dates to view logs
- **Device Filter**: Search by device name or ID
- **User Message**: Search within user messages
- **AI Model**: Filter by specific AI model (e.g., gemini-2.0-flash-lite)
- **Confidence**: Set min/max confidence scores (0.0-1.0)
- **Processing Time**: Filter by response time in milliseconds
- **Token Usage**: Filter by token consumption
- **Quick Time Ranges**: Last hour, 24h, 7 days, 30 days

#### Viewing Logs
Each log card shows:
- User's original message
- AI response preview (expandable to full text)
- Confidence score with color-coded badge:
  - 🟢 **High** (0.7-1.0) - Green
  - 🟡 **Medium** (0.4-0.7) - Yellow
  - 🔴 **Low** (0-0.4) - Red
- AI model used
- Processing metrics (time, tokens, sources)
- Related questions suggestions
- Conversation context (message number in conversation)

#### Expanding Details
Click "View Details" to see:
- Full AI response (with markdown formatting)
- All source citations with links
- Complete list of related questions
- Conversation metadata
- User agent information

#### Actions
- **Sort**: By date, confidence, or processing time
- **Export**: Download selected logs as CSV
- **Select All**: Bulk select for export
- **Pagination**: Navigate through large datasets

### AI Analytics Dashboard (`/ai-analytics`)

#### Overview Metrics
- Total AI chats in period
- Average confidence score
- Average processing time
- Average tokens used per conversation

#### Visualizations

1. **AI Model Distribution**
   - Which AI models are being used most
   - Helps track model adoption

2. **Device Usage**
   - Which devices generate the most AI chats
   - Identify power users

3. **Confidence Distribution**
   - How confident the AI is in responses
   - Quality control metric

4. **Processing Time Distribution**
   - Response time patterns
   - Performance monitoring

5. **Daily Chat Trends**
   - Usage patterns over time
   - Identify peak usage days

6. **Hourly Distribution**
   - When users interact with AI most
   - Optimize resource allocation

7. **Token Usage Distribution**
   - Cost estimation and optimization
   - Identify resource-heavy queries

8. **Top User Queries**
   - Most common questions
   - Content insights

#### Per-Device Analytics

Click "Show Per-Device" to see:
- Individual device statistics
- Device-specific charts
- Top queries per device
- Average metrics per device

Click "View Details" on any device for:
- Full analytics modal
- AI models used by that device
- Usage patterns
- Device-specific trends

## 🎨 UI/UX Features

### Visual Design
- **Purple Theme**: AI chat pages use purple to distinguish from search logs (blue)
- **Confidence Colors**: Easy-to-read color coding for response quality
- **Responsive**: Works on desktop, tablet, and mobile
- **Modern**: Clean, professional interface

### Performance
- **Debounced Search**: Smooth, non-blocking search experience
- **Client-side Filtering**: Fast filter application
- **Pagination**: Quick loading even with large datasets
- **Optimized Rendering**: React performance optimizations

## 📝 Example Use Cases

### Quality Monitoring
1. Go to `/ai-analytics`
2. Check "Avg Confidence" metric
3. Review "Confidence Distribution" chart
4. Filter low-confidence responses in `/ai-chats` to investigate

### Cost Analysis
1. View "Avg Tokens Used" in analytics
2. Check "Token Usage Distribution"
3. Export high-token conversations for review
4. Optimize prompts based on findings

### User Behavior
1. Check "Top User Queries"
2. Review "Hourly Distribution" for peak times
3. Analyze "Daily Chat Trends"
4. Plan resources accordingly

### Device Management
1. Enable "Show Per-Device" in analytics
2. Identify most active devices
3. Review device-specific patterns
4. Customize experiences per device

### Troubleshooting
1. Filter by low confidence scores
2. Sort by high processing times
3. Review error patterns
4. Export problematic logs for debugging

## 🔍 Understanding Your Data

### Confidence Score
- **0.7-1.0**: AI is very confident in the response
- **0.4-0.7**: AI has moderate confidence
- **0.0-0.4**: AI is uncertain (review recommended)

### Processing Time
- **<1s**: Very fast response
- **1-3s**: Normal response time
- **3-5s**: Slower, complex query
- **>5s**: Very slow (investigate if frequent)

### Token Usage
- **<200**: Simple query
- **200-500**: Standard conversation
- **500-1000**: Complex query
- **1000-2000**: Extended conversation
- **>2000**: Very long interaction (cost consideration)

### Sources Count
- Number of citations/references used
- Higher = more comprehensive answer
- 0 = No external sources (may be concerning)

## 📤 Exporting Data

### Single Export
1. Apply desired filters
2. Click "Export CSV" button
3. All filtered logs download as CSV

### Bulk Export
1. Check "Select All" or select specific logs
2. Click "Export Selected"
3. Only selected logs download

### CSV Format
Includes:
- Date/Time
- Device ID/Name
- User Message
- AI Model
- Confidence
- Processing Time (ms)
- Tokens Used
- Sources Count

## 🔗 Navigation

From any page, access:
- **Search Logs** - Regular search tracking
- **Analytics** - Search analytics
- **AI Chats** - AI conversation logs
- **AI Analytics** - AI conversation analytics
- **Devices** - Device management
- **Logout** - Sign out

## ⚡ Pro Tips

1. **Use Time Ranges**: Start with quick filters (Last 24h) before custom dates
2. **Sort Smart**: Sort by confidence to find quality issues quickly
3. **Export Often**: Regular exports help with reporting and analysis
4. **Monitor Trends**: Check daily trends to understand usage patterns
5. **Device Analytics**: Use per-device view to identify training needs
6. **Bookmark**: Save `/ai-analytics` as bookmark for quick access
7. **Combine Filters**: Use multiple filters together for precise searches
8. **Check Sources**: Low source counts might indicate answer quality issues

## 🐛 Troubleshooting

### No Data Showing
- Check date range includes data
- Verify filters aren't too restrictive
- Ensure Firebase has `aiChatLogs` data
- Try "Clear All Filters"

### Slow Loading
- Narrow date range
- Use pagination
- Apply filters before loading large datasets

### Export Issues
- Ensure pop-ups are allowed
- Check browser download settings
- Try selecting fewer logs

## 💡 Best Practices

1. **Regular Monitoring**: Check analytics weekly
2. **Quality Control**: Review low-confidence responses
3. **Cost Management**: Monitor token usage trends
4. **User Support**: Use top queries for FAQ development
5. **Performance**: Track processing times for SLA compliance
6. **Device Training**: Use per-device analytics for targeted training

## 🎯 Next Steps

1. Explore the AI Chat Logs page
2. Review initial analytics
3. Set up regular monitoring schedule
4. Export baseline data for comparison
5. Customize your workflow based on needs

---

**Questions or Issues?** The system mirrors the existing search logs functionality, so if you're familiar with that, you'll feel right at home with AI Chat Logs!

