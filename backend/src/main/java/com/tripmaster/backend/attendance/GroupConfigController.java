package com.tripmaster.backend.attendance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/group-config")
public class GroupConfigController {
    
    @Autowired
    private GroupConfigService groupConfigService;
    
    // ==================== Team Group Management ====================
    
    @GetMapping("/groups")
    public Page<GroupConfigDTO.TeamGroupResponse> getAllGroups(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
        return groupConfigService.getAllGroups(pageable);
    }
    
    @PostMapping("/groups")
    public ResponseEntity<?> createGroup(@RequestBody GroupConfigDTO.TeamGroupRequest request) {
        try {
            TeamGroup group = groupConfigService.createGroup(request);
            return ResponseEntity.ok(group);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @PutMapping("/groups/{id}")
    public ResponseEntity<?> updateGroup(
            @PathVariable Long id,
            @RequestBody GroupConfigDTO.TeamGroupRequest request) {
        try {
            TeamGroup group = groupConfigService.updateGroup(id, request);
            return ResponseEntity.ok(group);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/groups/{id}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long id) {
        try {
            groupConfigService.deleteGroup(id);
            return ResponseEntity.ok(Map.of("message", "Group deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== Member Mapping Management ====================
    
    @GetMapping("/members")
    public Page<GroupConfigDTO.MemberMappingResponse> getAllMembers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) Boolean emptyGroup,
            @RequestParam(required = false) String memberName) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("updatedAt").descending());
        return groupConfigService.getAllMembers(pageable, groupId, emptyGroup, memberName);
    }
    
    @PostMapping("/members")
    public ResponseEntity<?> createMember(@RequestBody GroupConfigDTO.MemberMappingRequest request) {
        try {
            MemberGroupMapping member = groupConfigService.createMember(request);
            return ResponseEntity.ok(GroupConfigDTO.MemberMappingResponse.fromEntity(member));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @PutMapping("/members/{id}")
    public ResponseEntity<?> updateMember(
            @PathVariable Long id,
            @RequestBody GroupConfigDTO.MemberMappingRequest request) {
        try {
            MemberGroupMapping member = groupConfigService.updateMember(id, request);
            return ResponseEntity.ok(GroupConfigDTO.MemberMappingResponse.fromEntity(member));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/members/{id}")
    public ResponseEntity<?> deleteMember(@PathVariable Long id) {
        try {
            groupConfigService.deleteMember(id);
            return ResponseEntity.ok(Map.of("message", "Member deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    @DeleteMapping("/members/batch")
    public ResponseEntity<?> batchDeleteMembers(@RequestBody GroupConfigDTO.BatchDeleteRequest request) {
        try {
            groupConfigService.batchDelete(request.getDeleteType());
            return ResponseEntity.ok(Map.of("message", "Members deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== CSV Import ====================
    
    @PostMapping("/import/csv")
    public ResponseEntity<?> importFromCsv(@RequestPart("file") MultipartFile file) {
        try {
            GroupConfigDTO.ImportResult result = groupConfigService.importFromCsv(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== Get Mapping (for attendance import) ====================
    
    @GetMapping("/members/mapping")
    public Map<String, String> getMemberGroupMapping() {
        return groupConfigService.getMappingMap();
    }
}
