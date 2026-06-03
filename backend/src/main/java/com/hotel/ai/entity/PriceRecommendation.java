package com.hotel.ai.entity;

import java.math.BigDecimal;
import java.util.Date;

/**
 * Maps to price_recommendations table.
 */
public class PriceRecommendation {
    private Integer id;
    private Integer roomId;
    private String roomType;
    private BigDecimal currentPrice;
    private BigDecimal suggestedPrice;
    private BigDecimal changePct;
    private BigDecimal occupancyPct;
    private BigDecimal confidence;
    private String reasoning;    // JSON string
    private String status;       // PENDING / APPROVED / REJECTED
    private String rejectReason;
    private String createdBy;
    private String reviewedBy;
    private Date createdAt;
    private Date reviewedAt;

    // ── Getters / Setters ──
    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public Integer getRoomId() { return roomId; }
    public void setRoomId(Integer roomId) { this.roomId = roomId; }
    public String getRoomType() { return roomType; }
    public void setRoomType(String roomType) { this.roomType = roomType; }
    public BigDecimal getCurrentPrice() { return currentPrice; }
    public void setCurrentPrice(BigDecimal currentPrice) { this.currentPrice = currentPrice; }
    public BigDecimal getSuggestedPrice() { return suggestedPrice; }
    public void setSuggestedPrice(BigDecimal suggestedPrice) { this.suggestedPrice = suggestedPrice; }
    public BigDecimal getChangePct() { return changePct; }
    public void setChangePct(BigDecimal changePct) { this.changePct = changePct; }
    public BigDecimal getOccupancyPct() { return occupancyPct; }
    public void setOccupancyPct(BigDecimal occupancyPct) { this.occupancyPct = occupancyPct; }
    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }
    public String getReasoning() { return reasoning; }
    public void setReasoning(String reasoning) { this.reasoning = reasoning; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }
    public Date getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Date reviewedAt) { this.reviewedAt = reviewedAt; }
}
