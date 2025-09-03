# 后端 API 规格

## 赛季管理
- **POST** `/api/seasons` - 创建赛季
- **GET** `/api/seasons` - 获取赛季列表
- **PUT** `/api/seasons/{id}` - 更新赛季
- **DELETE** `/api/seasons/{id}` - 删除赛季

## 考勤会话管理
- **POST** `/api/attendance-sessions` - 创建考勤会话
- **GET** `/api/attendance-sessions` - 获取考勤会话列表
- **GET** `/api/attendance-sessions/{id}` - 获取考勤会话详情
- **PUT** `/api/attendance-sessions/{id}` - 更新考勤会话
- **DELETE** `/api/attendance-sessions/{id}` - 删除考勤会话

## 奖惩条件管理
- **POST** `/api/reward-conditions` - 创建奖惩条件
- **GET** `/api/reward-conditions/session/{sessionId}` - 获取会话的奖惩条件
- **PUT** `/api/reward-conditions/{id}` - 更新奖惩条件
- **DELETE** `/api/reward-conditions/{id}` - 删除奖惩条件

## 结算管理
- **POST** `/api/settlement/execute` - 执行结算
- **POST** `/api/settlement/revoke` - 撤销结算
- **GET** `/api/settlement/details/{seasonId}` - 获取赛季结算明细
- **GET** `/api/settlement/logs` - 获取结算日志

## 合成管理
- **GET** `/api/synthesis/chains/{seasonId}` - 获取赛季合成链
- **GET** `/api/synthesis/logs/{seasonId}` - 获取赛季合成日志

## 码表管理
- **GET** `/api/code-tables` - 获取码表列表
- **POST** `/api/code-tables` - 创建码表项
- **PUT** `/api/code-tables/{id}` - 更新码表项
- **DELETE** `/api/code-tables/{id}` - 删除码表项

## 统计与榜单
- **GET** `/api/ranking/{seasonId}` - 获取赛季榜单
- **GET** `/api/ranking/{seasonId}/team-items` - 获取团队物品汇总

## 数据导出
- **POST** `/api/export/attendance` - 导出考勤统计图片

## 统一响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2025-01-01T00:00:00Z",
  "traceId": "uuid"
}
```

## 错误码
- `200`: 成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

