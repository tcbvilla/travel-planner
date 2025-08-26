package com.tripmaster.backend.attendance;

public class DisplayRow {
    private String 成员;
    private String 分组;
    private long 前值;
    private long 后值;
    private long 差值;
    private boolean 达标;

    public String get成员() { return 成员; }
    public void set成员(String 成员) { this.成员 = 成员; }

    public String get分组() { return 分组; }
    public void set分组(String 分组) { this.分组 = 分组; }

    public long get前值() { return 前值; }
    public void set前值(long 前值) { this.前值 = 前值; }

    public long get后值() { return 后值; }
    public void set后值(long 后值) { this.后值 = 后值; }

    public long get差值() { return 差值; }
    public void set差值(long 差值) { this.差值 = 差值; }

    public boolean is达标() { return 达标; }
    public void set达标(boolean 达标) { this.达标 = 达标; }
}


