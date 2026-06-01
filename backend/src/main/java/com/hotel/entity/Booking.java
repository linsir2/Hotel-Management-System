package com.hotel.entity;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;

@Data
public class Booking {
    private Integer id;
    private Integer roomId;
    private Integer guestId;
    private Date checkIn;
    private Date checkOut;
    private String status;
    private BigDecimal totalAmount;

    // Fields for frontend mapping
    private String guestName;
    private String roomNumber;

    // Optional: Nesting for easier JSON response
    private Room room;
    private Guest guest;
}
