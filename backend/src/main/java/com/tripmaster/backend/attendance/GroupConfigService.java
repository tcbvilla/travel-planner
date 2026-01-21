package com.tripmaster.backend.attendance;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class GroupConfigService {
    
    @Autowired
    private TeamGroupRepository teamGroupRepository;
    
    @Autowired
    private MemberGroupMappingRepository memberMappingRepository;
    
    // Team Group operations
    public Page<GroupConfigDTO.TeamGroupResponse> getAllGroups(Pageable pageable) {
        return teamGroupRepository.findAll(pageable)
            .map(group -> {
                long memberCount = memberMappingRepository.countByTeamGroup(group);
                return GroupConfigDTO.TeamGroupResponse.fromEntity(group, memberCount);
            });
    }
    
    public TeamGroup createGroup(GroupConfigDTO.TeamGroupRequest request) {
        if (request.getGroupName() == null || request.getGroupName().trim().isEmpty()) {
            throw new RuntimeException("Group name is required");
        }
        
        String groupName = request.getGroupName().trim();
        if (teamGroupRepository.existsByGroupName(groupName)) {
            throw new RuntimeException("Group name already exists: " + groupName);
        }
        
        TeamGroup group = new TeamGroup();
        group.setGroupName(groupName);
        group.setDescription(request.getDescription());
        return teamGroupRepository.save(group);
    }
    
    public TeamGroup updateGroup(Long id, GroupConfigDTO.TeamGroupRequest request) {
        TeamGroup group = teamGroupRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Group not found"));
        
        if (request.getGroupName() != null && !request.getGroupName().trim().isEmpty()) {
            String newName = request.getGroupName().trim();
            if (!newName.equals(group.getGroupName())) {
                if (teamGroupRepository.existsByGroupName(newName)) {
                    throw new RuntimeException("Group name already exists: " + newName);
                }
                group.setGroupName(newName);
            }
        }
        
        if (request.getDescription() != null) {
            group.setDescription(request.getDescription());
        }
        
        return teamGroupRepository.save(group);
    }
    
    @Transactional
    public void deleteGroup(Long id) {
        TeamGroup group = teamGroupRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Group not found"));
        
        // Set group_id to null for all members in this group
        List<MemberGroupMapping> members = memberMappingRepository.findByTeamGroup(group);
        members.forEach(m -> m.setTeamGroup(null));
        memberMappingRepository.saveAll(members);
        
        // Delete the group
        teamGroupRepository.delete(group);
    }
    
    // Member Mapping operations
    public Page<GroupConfigDTO.MemberMappingResponse> getAllMembers(Pageable pageable, Long groupId, Boolean emptyGroup, String memberName) {
        Page<MemberGroupMapping> page;
        
        boolean hasSearch = memberName != null && !memberName.trim().isEmpty();
        
        if (emptyGroup != null && emptyGroup) {
            if (hasSearch) {
                page = memberMappingRepository.findByTeamGroupIsNullAndMemberNameContainingIgnoreCase(memberName.trim(), pageable);
            } else {
                page = memberMappingRepository.findByTeamGroupIsNull(pageable);
            }
        } else if (groupId != null) {
            TeamGroup group = teamGroupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found"));
            if (hasSearch) {
                page = memberMappingRepository.findByTeamGroupAndMemberNameContainingIgnoreCase(group, memberName.trim(), pageable);
            } else {
                page = memberMappingRepository.findByTeamGroup(group, pageable);
            }
        } else {
            if (hasSearch) {
                page = memberMappingRepository.findByMemberNameContainingIgnoreCase(memberName.trim(), pageable);
            } else {
                page = memberMappingRepository.findAll(pageable);
            }
        }
        
        return page.map(GroupConfigDTO.MemberMappingResponse::fromEntity);
    }
    
    public MemberGroupMapping createMember(GroupConfigDTO.MemberMappingRequest request) {
        if (request.getMemberName() == null || request.getMemberName().trim().isEmpty()) {
            throw new RuntimeException("Member name is required");
        }
        
        String memberName = request.getMemberName().trim();
        if (memberMappingRepository.findByMemberName(memberName).isPresent()) {
            throw new RuntimeException("Member already exists: " + memberName);
        }
        
        MemberGroupMapping mapping = new MemberGroupMapping();
        mapping.setMemberName(memberName);
        
        if (request.getGroupId() != null) {
            TeamGroup group = teamGroupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new RuntimeException("Group not found"));
            mapping.setTeamGroup(group);
        }
        
        return memberMappingRepository.save(mapping);
    }
    
    public MemberGroupMapping updateMember(Long id, GroupConfigDTO.MemberMappingRequest request) {
        MemberGroupMapping mapping = memberMappingRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Member not found"));
        
        if (request.getMemberName() != null && !request.getMemberName().trim().isEmpty()) {
            String newName = request.getMemberName().trim();
            if (!newName.equals(mapping.getMemberName())) {
                if (memberMappingRepository.findByMemberName(newName).isPresent()) {
                    throw new RuntimeException("Member name already exists: " + newName);
                }
                mapping.setMemberName(newName);
            }
        }
        
        if (request.getGroupId() != null) {
            TeamGroup group = teamGroupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new RuntimeException("Group not found"));
            mapping.setTeamGroup(group);
        } else {
            mapping.setTeamGroup(null);
        }
        
        return memberMappingRepository.save(mapping);
    }
    
    public void deleteMember(Long id) {
        memberMappingRepository.deleteById(id);
    }
    
    @Transactional
    public void batchDelete(String deleteType) {
        if ("ALL".equals(deleteType)) {
            memberMappingRepository.deleteAll();
        } else if ("EMPTY_GROUP".equals(deleteType)) {
            memberMappingRepository.deleteByTeamGroupIsNull();
        } else {
            throw new RuntimeException("Invalid delete type: " + deleteType);
        }
    }
    
    // CSV Import
    @Transactional
    public GroupConfigDTO.ImportResult importFromCsv(MultipartFile file) throws Exception {
        List<Map<String, String>> rows = parseCsv(file);
        
        int created = 0, updated = 0, unmatchedGroups = 0;
        
        for (Map<String, String> row : rows) {
            String memberName = row.get("成员");
            // Support both "分组" and "门阀" column names
            String groupName = getGroupNameFromRow(row);
            
            if (memberName == null || memberName.trim().isEmpty()) {
                continue;
            }
            
            memberName = memberName.trim();
            
            // Find or create member
            Optional<MemberGroupMapping> existingOpt = memberMappingRepository.findByMemberName(memberName);
            MemberGroupMapping member;
            boolean isNew;
            
            if (existingOpt.isPresent()) {
                member = existingOpt.get();
                isNew = false;
            } else {
                member = new MemberGroupMapping();
                member.setMemberName(memberName);
                isNew = true;
            }
            
            // Handle group
            if (groupName != null && !groupName.trim().isEmpty()) {
                Optional<TeamGroup> groupOpt = teamGroupRepository.findByGroupName(groupName.trim());
                if (groupOpt.isPresent()) {
                    member.setTeamGroup(groupOpt.get());
                } else {
                    member.setTeamGroup(null);
                    unmatchedGroups++;
                }
            } else {
                member.setTeamGroup(null);
            }
            
            memberMappingRepository.save(member);
            if (isNew) {
                created++;
            } else {
                updated++;
            }
        }
        
        return new GroupConfigDTO.ImportResult(created, updated, unmatchedGroups);
    }
    
    // Get mapping for attendance import
    public Map<String, String> getMappingMap() {
        List<MemberGroupMapping> mappings = memberMappingRepository.findAll();
        
        return mappings.stream()
            .filter(m -> m.getTeamGroup() != null)
            .collect(Collectors.toMap(
                MemberGroupMapping::getMemberName,
                m -> m.getTeamGroup().getGroupName()
            ));
    }
    
    private List<Map<String, String>> parseCsv(MultipartFile file) throws Exception {
        List<Map<String, String>> result = new ArrayList<>();
        
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            
            String headerLine = br.readLine();
            if (headerLine == null) return result;
            
            // Remove BOM if present
            if (headerLine.startsWith("\uFEFF")) {
                headerLine = headerLine.substring(1);
            }
            
            String[] headers = headerLine.split(",");
            for (int i = 0; i < headers.length; i++) {
                headers[i] = headers[i].trim();
            }
            
            String line;
            while ((line = br.readLine()) != null) {
                String[] values = line.split(",", -1);
                Map<String, String> row = new HashMap<>();
                
                for (int i = 0; i < Math.min(headers.length, values.length); i++) {
                    row.put(headers[i], values[i].trim());
                }
                
                result.add(row);
            }
        }
        
        return result;
    }
    
    /**
     * Get group name from CSV row, supporting both "分组" and "门阀" column names
     * Priority: "分组" > "门阀"
     */
    private String getGroupNameFromRow(Map<String, String> row) {
        String groupName = row.get("分组");
        if (groupName != null && !groupName.trim().isEmpty()) {
            return groupName;
        }
        // Fallback to "门阀" if "分组" is not available
        return row.get("门阀");
    }
}
