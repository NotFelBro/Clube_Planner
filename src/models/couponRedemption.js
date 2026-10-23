const mongoose = require('mongoose');

const couponRedemptionSchema = new mongoose.Schema({
  couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true, immutable: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, immutable: true },
  status: { type: String, enum: ['reserved', 'consumed', 'released'], required: true, default: 'reserved' },
  consumedAt: { type: Date, default: null },
  releasedAt: { type: Date, default: null },
}, { collection: 'coupon_redemptions', timestamps: true, versionKey: false });

couponRedemptionSchema.index({ orderId: 1, couponId: 1 }, { unique: true });
couponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });
couponRedemptionSchema.index({ orderId: 1 });

module.exports = mongoose.models.CouponRedemption || mongoose.model('CouponRedemption', couponRedemptionSchema);
