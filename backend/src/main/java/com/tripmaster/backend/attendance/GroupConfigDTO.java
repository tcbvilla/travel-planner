package com.tripmaster.backend.attendance;

import lombok.Data;
import java.time.LocalDateTime;

public class GroupConfigDTO {
    
    @Data
    public static class TeamGroupRequest {
        private String groupName;
        private String description;
    }
    
    @Data
    public static class TeamGroupResponse {
        private Long id;
        private String groupName;
        private String description;
        private Long memberCount;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        
        public static TeamGroupResponse fromEntity(TeamGroup group, long memberCount) {
            TeamGroupResponse response = new TeamGroupResponse();
            response.setId(group.getId());
            response.setGroupName(group.getGroupName());
            response.setDescription(group.getDescription());
            response.setMemberCount(memberCount);
            response.setCreatedAt(group.getCreatedAt());
            response.setUpdatedAt(group.getUpdatedAt());
            return response;
        }
    }
    
    @Data
    public static class MemberMappingRequest {
        private String memberName;
        private Long groupId;  // Can be null
    }
    
    @Data
    public static class MemberMappingResponse {
        private Long id;
        private String memberName;
        private TeamGroupSimple teamGroup;  // Can be null
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        
        public static MemberMappingResponse fromEntity(MemberGroupMapping mapping) {
            MemberMappingResponse response = new MemberMappingResponse();
            response.setId(mapping.getId());
            response.setMemberName(mapping.getMemberName());
            if (mapping.getTeamGroup() != null) {
                TeamGroupSimple simple = new TeamGroupSimple();
                simple.setId(mapping.getTeamGroup().getId());
                simple.setGroupName(mapping.getTeamGroup().getGroupName());
                response.setTeamGroup(simple);
            }
            response.setCreatedAt(mapping.getCreatedAt());
            response.setUpdatedAt(mapping.getUpdatedAt());
            return response;
        }
    }
    
    @Data
    public static class TeamGroupSimple {
        private Long id;
        private String groupName;
    }
    
    @Data
    public static class ImportResult {
        private int created;
        private int updated;
        private int unmatchedGroups;
        
        public ImportResult(int created, int updated, int unmatchedGroups) {
            this.created = created;
            this.updated = updated;
            this.unmatchedGroups = unmatchedGroups;
        }
    }
    
    @Data
    public static class BatchDeleteRequest {
        private String deleteType;  // "ALL" or "EMPTY_GROUP"
    }
}
