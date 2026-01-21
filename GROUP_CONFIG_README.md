# Group Configuration Feature Implementation

## Overview
This feature allows administrators to configure member-to-group mappings that will be used during attendance CSV import, instead of relying on the group information in the CSV files.

## Features Implemented

### Backend (Java/Spring Boot)
1. **Entities**:
   - `TeamGroup`: Represents a group/team
   - `MemberGroupMapping`: Maps members to groups

2. **REST APIs** (`/api/v1/group-config`):
   - Group Management: CRUD operations for groups
   - Member Management: CRUD operations for member mappings
   - CSV Import: Bulk import members from CSV
   - Mapping Query: Get member→group mapping for attendance import

3. **Integration**:
   - Modified `AttendanceController.compare()` to apply group mapping
   - Groups configured in the system take priority over CSV groups

### Frontend (React/TypeScript)
1. **Configuration Management Page Restructure**:
   - Added 4 sub-tabs: Team Bonus, Team Logo, Ranking, **Group Config**
   
2. **Group Config Tab**:
   - **Groups Management**: Create, edit, delete groups
   - **Members Management**: Create, edit, delete members
   - **CSV Import**: Bulk import from CSV files
   - **Batch Operations**: Delete all or delete members with empty groups
   - **Filtering**: Filter members by group

## Database Setup

**数据库迁移会自动执行！**

项目使用 Liquibase 管理数据库迁移。当你重启 Spring Boot 应用时，Liquibase 会自动检测并执行新的 changeset。

新增的 changeset 文件：
- `backend/src/main/resources/db/changelog/changesets/014-add-group-config.xml`

这将创建两个表：
- `team_groups`: 存储小组定义
- `member_group_mappings`: 存储成员→小组映射

## Deployment

### Backend
1. 重启 Spring Boot 应用（Liquibase会自动执行数据库迁移）:
```bash
cd backend
# 如果后端正在运行，按 Ctrl+C 停止，然后重新启动：
mvn spring-boot:run

# 或者重新构建并运行：
mvn clean package
mvn spring-boot:run
```

2. 查看日志确认 Liquibase 执行成功：
   - 应该能看到类似 "Running Changeset: db/changelog/changesets/014-add-group-config.xml..." 的日志
   - 确认两个表创建成功

### Frontend
1. The frontend changes are in `App.tsx` - no build needed if using dev server
2. For production:
```bash
cd frontend
npm run build
```

## Usage Guide

### 1. Create Groups
1. Navigate to: **Configuration Management** → **Group Config** → **Groups**
2. Click "New Group"
3. Enter group name and optional description
4. Click "Save"

### 2. Add Members Manually
1. Navigate to: **Configuration Management** → **Group Config** → **Members**
2. Click "New Member"
3. Enter member name and select a group (optional)
4. Click "Save"

### 3. Import Members from CSV
1. Navigate to: **Configuration Management** → **Group Config** → **Members**
2. Click "Import from CSV"
3. Select a CSV file with "成员" and "分组" columns
4. Click "Import"
5. View the import result:
   - Created: New members added
   - Updated: Existing members updated
   - Unmatched Groups: Members whose groups don't exist (set to empty)

### 4. Use in Attendance Import
When you import attendance CSV files:
1. The system will check if a member exists in the mapping table
2. If found: Use the configured group
3. If not found: Use the group from the CSV file
4. The logs will show: "Member: XXX, CSV group: YYY, Final group: ZZZ"

### 5. Manage Members
- **Filter by Group**: Use the dropdown to show only members in a specific group or with empty groups
- **Edit**: Change member's name or assigned group
- **Delete**: Remove individual members
- **Batch Delete All**: Remove all members
- **Batch Delete Empty Group**: Remove only members without assigned groups

## Data Flow

```
CSV Import
    ↓
Check MemberGroupMapping
    ↓
┌─────────────┬──────────────┐
│ Found       │ Not Found    │
│ Use mapped  │ Use CSV      │
│ group       │ group        │
└─────────────┴──────────────┘
    ↓
Save to AttendanceSession
    ↓
All subsequent calculations use saved group
```

## API Endpoints

### Groups
- `GET /api/v1/group-config/groups?page=0&size=20` - List groups
- `POST /api/v1/group-config/groups` - Create group
- `PUT /api/v1/group-config/groups/{id}` - Update group
- `DELETE /api/v1/group-config/groups/{id}` - Delete group

### Members
- `GET /api/v1/group-config/members?page=0&size=20&groupId={id}&emptyGroup={true/false}` - List members
- `POST /api/v1/group-config/members` - Create member
- `PUT /api/v1/group-config/members/{id}` - Update member
- `DELETE /api/v1/group-config/members/{id}` - Delete member
- `DELETE /api/v1/group-config/members/batch` - Batch delete

### Import/Export
- `POST /api/v1/group-config/import/csv` - Import from CSV
- `GET /api/v1/group-config/members/mapping` - Get mapping (used by attendance import)

## Technical Details

### Foreign Key Behavior
- `member_group_mappings.group_id` → `team_groups.id`
- `ON DELETE SET NULL`: When a group is deleted, members' group_id is set to NULL (not deleted)

### CSV Import Logic
1. Parse CSV with "成员" and "分组" columns
2. For each row:
   - Trim member name and group name
   - Check if member exists (by name)
   - Check if group exists (by name)
   - Create or update member with appropriate group_id
3. Return statistics

### Mapping Cache (Optional Enhancement)
Consider adding Redis cache for `getMappingMap()` to improve performance:
```java
@Cacheable(value = "memberGroupMapping", key = "'all'")
public Map<String, String> getMappingMap() { ... }
```

## Testing Checklist

- [ ] Create a group
- [ ] Edit a group
- [ ] Delete a group (verify members' groups set to empty)
- [ ] Create a member manually
- [ ] Edit a member
- [ ] Delete a member
- [ ] Import members from CSV
- [ ] Filter members by group
- [ ] Filter members with empty group
- [ ] Batch delete empty group members
- [ ] Import attendance CSV and verify mapping is applied
- [ ] Check saved attendance session uses mapped groups
- [ ] Verify subsequent calculations use mapped groups

## Troubleshooting

### Groups not applying to attendance import
1. Check logs: Look for "Loaded member-group mapping, size: X"
2. Verify member names match exactly (case-sensitive, no extra spaces)
3. Check the "Final group" in logs to see what group was actually used

### CSV import failing
1. Ensure CSV has "成员" and "分组" columns
2. Check CSV encoding (UTF-8 or GBK)
3. Verify groups exist before importing members

### Frontend not loading data
1. Check browser console for errors
2. Verify backend is running
3. Check network tab for API responses

## Future Enhancements

1. **Group Hierarchy**: Support parent-child group relationships
2. **Bulk Edit**: Update multiple members at once
3. **Import/Export**: Export current mappings to CSV
4. **History**: Track changes to mappings over time
5. **Validation Rules**: Add constraints (e.g., max members per group)
6. **Search**: Add member name search functionality

## Support

For issues or questions, please contact the development team.
