-- ============================================================
-- AI Module Database Migration (Tier 1)
-- Run AFTER init.sql has been executed.
-- Creates 6 new tables + alters existing tables.
-- ============================================================

USE `hotel_db`;

-- -----------------------------------------------------------
-- 1. audit_log — AI调用审计日志
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_log` (
    `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
    `user_id` INT COMMENT '操作用户ID',
    `username` VARCHAR(50) COMMENT '用户名',
    `action` VARCHAR(100) NOT NULL COMMENT '操作类型: AI_SEARCH/AI_ANOMALY_SCAN/...',
    `endpoint` VARCHAR(200) COMMENT '调用的API端点',
    `request_summary` VARCHAR(500) COMMENT '请求摘要(已脱敏)',
    `response_summary` VARCHAR(500) COMMENT '响应摘要(已脱敏)',
    `status` VARCHAR(20) NOT NULL DEFAULT 'SUCCESS' COMMENT 'SUCCESS/ERROR',
    `error_msg` VARCHAR(1000) COMMENT '错误信息',
    `duration_ms` INT COMMENT '耗时(毫秒)',
    `ip_address` VARCHAR(50) COMMENT '请求IP',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (`user_id`),
    INDEX idx_audit_action (`action`),
    INDEX idx_audit_created (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI调用审计日志';

-- -----------------------------------------------------------
-- 2. price_recommendations — 定价建议(审批工作流)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `price_recommendations` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `room_id` INT NOT NULL,
    `room_type` VARCHAR(50) NOT NULL,
    `current_price` DECIMAL(10,2) NOT NULL,
    `suggested_price` DECIMAL(10,2) NOT NULL,
    `change_pct` DECIMAL(5,2) COMMENT '变化百分比',
    `occupancy_pct` DECIMAL(5,2) COMMENT '入住率百分比',
    `confidence` DECIMAL(5,4) COMMENT '置信度 0-1',
    `reasoning` JSON COMMENT '推理因子明细',
    `status` ENUM('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
    `reject_reason` VARCHAR(500) COMMENT '拒绝原因',
    `created_by` VARCHAR(50) DEFAULT 'AI_SERVICE',
    `reviewed_by` VARCHAR(50) COMMENT '审批人',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `reviewed_at` DATETIME COMMENT '审批时间',
    FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`),
    INDEX idx_pr_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定价建议表';

-- -----------------------------------------------------------
-- 3. price_history — 价格变更历史
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `price_history` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `room_id` INT NOT NULL,
    `old_price` DECIMAL(10,2) NOT NULL,
    `new_price` DECIMAL(10,2) NOT NULL,
    `recommendation_id` INT COMMENT '关联定价建议ID',
    `changed_by` VARCHAR(50) NOT NULL,
    `changed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`),
    FOREIGN KEY (`recommendation_id`) REFERENCES `price_recommendations`(`id`),
    INDEX idx_ph_room (`room_id`),
    INDEX idx_ph_changed (`changed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='价格变更历史';

-- -----------------------------------------------------------
-- 4. housekeeping_tasks — 保洁清扫清单
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `housekeeping_tasks` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `room_id` INT NOT NULL,
    `task_type` ENUM('CHECKOUT_CLEAN','DAILY_CLEAN','DEEP_CLEAN','MAINTENANCE_READY') NOT NULL,
    `scheduled_date` DATE NOT NULL,
    `priority` TINYINT NOT NULL DEFAULT 3 COMMENT '1=最高 3=普通',
    `status` ENUM('PENDING','IN_PROGRESS','COMPLETED','SKIPPED') DEFAULT 'PENDING',
    `notes` VARCHAR(500),
    `completed_by` VARCHAR(50),
    `completed_at` DATETIME,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`),
    INDEX idx_hk_date (`scheduled_date`),
    INDEX idx_hk_status (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='保洁清扫任务';

-- -----------------------------------------------------------
-- 5. external_events — 外部事件配置(节假日/活动/竞品)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `external_events` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `event_date` DATE NOT NULL,
    `event_name` VARCHAR(200) NOT NULL,
    `event_type` ENUM('HOLIDAY','LOCAL_EVENT','COMPETITOR_INFO','OTHER') NOT NULL,
    `impact_level` ENUM('HIGH','MEDIUM','LOW') NOT NULL,
    `impact_direction` ENUM('PRICE_UP','PRICE_DOWN','OCCUPANCY_UP','OCCUPANCY_DOWN'),
    `competitor_avg_price` DECIMAL(10,2),
    `notes` VARCHAR(500),
    `entered_by` VARCHAR(50),
    `last_updated` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ee_date (`event_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外部事件配置表';

-- -----------------------------------------------------------
-- 6. operation_losses — 隐性损耗盘点
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operation_losses` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `report_period` VARCHAR(7) NOT NULL COMMENT '报告期, 如 2026-06',
    `report_type` ENUM('MONTHLY','DAILY') NOT NULL,
    `loss_category` ENUM('PRICE_MISMATCH','VACANCY','ANOMALY_ORDER') NOT NULL,
    `loss_amount` DECIMAL(12,2) NOT NULL,
    `detail_json` JSON COMMENT '损耗明细JSON',
    `generated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ol_period (`report_period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='经营损耗报表';

-- -----------------------------------------------------------
-- ALTER: 现有表补充字段
-- -----------------------------------------------------------
-- ALTER: 现有表补充字段 (MySQL 8.0 兼容)
-- 使用存储过程实现幂等，避免重复执行报错

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS add_column_if_missing(
    IN tbl VARCHAR(128), IN col VARCHAR(128), IN col_def TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'hotel_db' AND TABLE_NAME = tbl AND COLUMN_NAME = col
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', col_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL add_column_if_missing('bookings', 'created_at', "DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'");
CALL add_column_if_missing('bookings', 'updated_at', "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'");
CALL add_column_if_missing('rooms', 'last_cleaned_at', "DATETIME COMMENT '最后清扫时间'");

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- -----------------------------------------------------------
-- 创建只读账号(需手动执行, DBA操作)
-- -----------------------------------------------------------
-- CREATE USER IF NOT EXISTS 'ai_reader'@'%' IDENTIFIED BY 'ai_reader_pass';
-- GRANT SELECT ON hotel_db.* TO 'ai_reader'@'%';
-- FLUSH PRIVILEGES;
