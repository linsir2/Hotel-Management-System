CREATE DATABASE IF NOT EXISTS `hotel_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE `hotel_db`;

-- 用户表
CREATE TABLE `users` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `username` VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
    `password` VARCHAR(100) NOT NULL COMMENT '密码',
    `real_name` VARCHAR(50) COMMENT '真实姓名',
    `role` VARCHAR(20) DEFAULT 'STAFF' COMMENT '角色: ADMIN/STAFF'
);

-- 房间表
CREATE TABLE `rooms` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `room_number` VARCHAR(20) UNIQUE NOT NULL COMMENT '房间号',
    `type` VARCHAR(50) NOT NULL COMMENT '房间类型',
    `price` DECIMAL(10, 2) NOT NULL COMMENT '价格',
    `status` ENUM('AVAILABLE', 'OCCUPIED', 'MAINTENANCE') DEFAULT 'AVAILABLE' COMMENT '状态'
);

-- 住客表
CREATE TABLE `guests` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL COMMENT '姓名',
    `id_card` VARCHAR(20) UNIQUE NOT NULL COMMENT '身份证号',
    `phone` VARCHAR(20) COMMENT '手机号'
);

-- 预订表
CREATE TABLE `bookings` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `room_id` INT COMMENT '房间ID',
    `guest_id` INT COMMENT '住客ID',
    `check_in` DATETIME COMMENT '入住时间',
    `check_out` DATETIME COMMENT '退房时间',
    `status` VARCHAR(20) DEFAULT 'PENDING' COMMENT '订单状态',
    `total_amount` DECIMAL(10, 2) COMMENT '总金额',
    FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`),
    FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`)
);

-- 初始化房间数据
INSERT INTO `rooms` (`room_number`, `type`, `price`, `status`) VALUES
('101', '标准单人间', 199.00, 'AVAILABLE'),
('102', '标准双人间', 299.00, 'OCCUPIED'),
('201', '豪华大床房', 499.00, 'AVAILABLE'),
('202', '商务套房', 899.00, 'MAINTENANCE'),
('301', '总统套房', 1999.00, 'AVAILABLE'),
('302', '标准单人间', 199.00, 'AVAILABLE'),
('401', '豪华大床房', 499.00, 'OCCUPIED'),
('402', '商务套房', 899.00, 'AVAILABLE');

-- 初始化住客数据
INSERT INTO `guests` (`name`, `id_card`, `phone`) VALUES
('张伟', '110101199001010011', '13800138000'),
('李娜', '310101199205050022', '13912345678'),
('王五', '440101198512120033', '13788889999'),
('赵六', '510101198808080044', '13666667777');

-- 初始化预订数据
INSERT INTO `bookings` (`room_id`, `guest_id`, `check_in`, `check_out`, `status`, `total_amount`) VALUES
(1, 1, '2026-05-10 14:00:00', '2026-05-12 12:00:00', 'CONFIRMED', 998.00),
(2, 2, '2026-05-11 14:00:00', '2026-05-13 12:00:00', 'PENDING', 598.00),
(5, 3, '2026-05-08 14:00:00', '2026-05-11 12:00:00', 'COMPLETED', 3998.00),
(4, 4, '2026-05-15 14:00:00', '2026-05-17 12:00:00', 'CANCELLED', 1798.00);

-- 初始化用户数据 (默认密码: 123456)
INSERT INTO `users` (`username`, `password`, `real_name`, `role`) VALUES
('admin', '123456', '系统管理员', 'ADMIN'),
('staff', '123456', '酒店员工', 'STAFF');
