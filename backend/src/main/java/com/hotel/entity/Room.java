package com.hotel.entity;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class Room {
    private Integer id;
    private String roomNumber;
    private String type;
    private BigDecimal price;
    private String status;
}
