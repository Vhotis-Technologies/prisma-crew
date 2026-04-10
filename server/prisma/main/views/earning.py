from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, Avg, Count
from django.utils import timezone
from django.db.models import Q
from datetime import datetime, timedelta
from decimal import Decimal
from main.models import Job, Earning, Detailer, BankAccount, PayoutHistory

class EarningView(APIView):
    permission_classes = [IsAuthenticated]

    action_handler = {
        "get_earnings_summary": "_get_earnings_summary",
        "get_recent_earnings": "_get_recent_earnings",
        "get_earnings_analytics": "_get_earnings_analytics",
        "get_payout_history": "_get_payout_history",
        "get_bank_accounts": "_get_bank_accounts",
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)

        
    
    def _get_earnings_summary(self, request):
        """ This get the earning summary for each week  """
        try:
            from decimal import Decimal
            
            # Get the detailer for the authenticated user
            detailer = Detailer.objects.get(user=request.user)
            
            # Get current timezone-aware date
            now = timezone.now()
            today = now.date()
            
            # Calculate week boundaries (Sunday to Saturday)
            # Find the most recent Sunday
            days_since_sunday = (today.weekday() + 1) % 7  # Monday=0, Sunday=6
            start_of_current_week = today - timedelta(days=days_since_sunday)
            end_of_current_week = start_of_current_week + timedelta(days=6)
            
            # Previous week boundaries
            start_of_previous_week = start_of_current_week - timedelta(days=7)
            end_of_previous_week = start_of_previous_week + timedelta(days=6)
            
            # Get current week earnings
            current_week_earnings = Earning.objects.filter(
                detailer=detailer,
                created_at__date__range=[start_of_current_week, end_of_current_week]
            )
            
            # Get previous week earnings
            previous_week_earnings = Earning.objects.filter(
                detailer=detailer,
                created_at__date__range=[start_of_previous_week, end_of_previous_week]
            )
            
            # Calculate current week stats
            current_total_earned = current_week_earnings.aggregate(
                total=Sum('net_amount')
            )['total'] or Decimal('0')

            current_total_jobs = current_week_earnings.count()
            current_avg_per_job = current_total_earned / current_total_jobs if current_total_jobs > 0 else Decimal('0')

            # Calculate previous week stats
            previous_total_earned = previous_week_earnings.aggregate(
                total=Sum('net_amount')
            )['total'] or Decimal('0')

            # Calculate percentage change
            if previous_total_earned > 0:
                percentage_change = float(((current_total_earned - previous_total_earned) / previous_total_earned) * 100)
            else:
                percentage_change = 100.0 if current_total_earned > 0 else 0.0
            
            is_positive_change = percentage_change >= 0
            
            # Get pending payouts count
            pending_payouts = Earning.objects.filter(
                detailer=detailer,
                payment_status='pending'
            ).count()
            
            # Calculate next payout date (next Sunday)
            days_until_sunday = (6 - today.weekday()) % 7
            if days_until_sunday == 0:  # If today is Sunday
                days_until_sunday = 7  # Next Sunday
            next_payout_date = today + timedelta(days=days_until_sunday)
            
            # Get bank accounts count
            bank_accounts_count = BankAccount.objects.filter(detailer=detailer).count()
            
            # Build response data with default values to prevent undefined
            summary_data = {
                'total_earned': float(current_total_earned) if current_total_earned else 0.0,
                'total_jobs': current_total_jobs if current_total_jobs else 0,
                'average_per_job': float(current_avg_per_job) if current_avg_per_job else 0.0,
                'percentage_change': round(percentage_change, 2) if percentage_change is not None else 0.0,
                'is_positive_change': is_positive_change if is_positive_change is not None else False,
                'pending_payouts': pending_payouts if pending_payouts else 0,
                'next_payout_date': next_payout_date.isoformat() if next_payout_date else '',
                'bank_accounts_count': bank_accounts_count if bank_accounts_count else 0
            }
            
            return Response(summary_data, status=status.HTTP_200_OK)

        except Detailer.DoesNotExist:
            return Response({"error": "Detailer profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_earnings_analytics(self, request):
        """ Get comprehensive earnings analytics for the detailer """
        try:
            # Get the detailer for the authenticated user
            detailer = Detailer.objects.get(user=request.user)
            
            # Get all earnings for the detailer
            all_earnings = Earning.objects.filter(detailer=detailer)
            
            # Calculate total lifetime earnings
            total_lifetime_earnings = all_earnings.aggregate(
                total=Sum('net_amount')
            )['total'] or Decimal('0')

            # Calculate total jobs completed
            total_jobs_completed = all_earnings.count()

            # Calculate average weekly earnings (last 12 weeks)
            twelve_weeks_ago = timezone.now().date() - timedelta(weeks=12)
            recent_earnings = all_earnings.filter(created_at__date__gte=twelve_weeks_ago)
            
            weekly_earnings = []
            for i in range(12):
                week_start = twelve_weeks_ago + timedelta(weeks=i)
                week_end = week_start + timedelta(days=6)
                
                week_total = recent_earnings.filter(
                    created_at__date__range=[week_start, week_end]
                ).aggregate(
                    total=Sum('net_amount')
                )['total'] or Decimal('0')

                weekly_earnings.append(float(week_total))
            
            average_weekly_earnings = sum(weekly_earnings) / len(weekly_earnings) if weekly_earnings else 0
            
            # Calculate average monthly earnings (last 12 months)
            monthly_earnings = []
            for i in range(12):
                month_start = timezone.now().date().replace(day=1) - timedelta(days=30*i)
                month_end = month_start + timedelta(days=30)
                
                month_total = all_earnings.filter(
                    created_at__date__range=[month_start, month_end]
                ).aggregate(
                    total=Sum('net_amount')
                )['total'] or Decimal('0')

                monthly_earnings.append(float(month_total))
            
            average_monthly_earnings = sum(monthly_earnings) / len(monthly_earnings) if monthly_earnings else 0
            
            # Find best earning day of the week
            day_earnings = {}
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            
            for earning in all_earnings:
                day_name = days[earning.created_at.weekday()]
                total_earning = earning.net_amount

                if day_name not in day_earnings:
                    day_earnings[day_name] = Decimal('0')
                day_earnings[day_name] += total_earning
            
            best_earning_day = max(day_earnings.items(), key=lambda x: x[1])[0] if day_earnings else "Monday"
            
            # Find best earning month
            month_earnings = {}
            months = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December']
            
            for earning in all_earnings:
                month_name = months[earning.created_at.month - 1]
                total_earning = earning.net_amount

                if month_name not in month_earnings:
                    month_earnings[month_name] = Decimal('0')
                month_earnings[month_name] += total_earning
            
            best_earning_month = max(month_earnings.items(), key=lambda x: x[1])[0] if month_earnings else "January"
            
            # Calculate earnings trend (comparing last 4 weeks vs previous 4 weeks)
            four_weeks_ago = timezone.now().date() - timedelta(weeks=4)
            eight_weeks_ago = timezone.now().date() - timedelta(weeks=8)
            
            recent_4_weeks = all_earnings.filter(
                created_at__date__gte=four_weeks_ago
            ).aggregate(
                total=Sum('net_amount')
            )['total'] or Decimal('0')

            previous_4_weeks = all_earnings.filter(
                created_at__date__range=[eight_weeks_ago, four_weeks_ago]
            ).aggregate(
                total=Sum('net_amount')
            )['total'] or Decimal('0')

            recent_total = recent_4_weeks
            previous_total = previous_4_weeks
            
            if previous_total > 0:
                trend_percentage = float(((recent_total - previous_total) / previous_total) * 100)
            else:
                trend_percentage = 100.0 if recent_total > 0 else 0.0
            
            earnings_trend = "increasing" if trend_percentage > 0 else "decreasing" if trend_percentage < 0 else "stable"
            
            # Build analytics data
            analytics_data = {
                'total_lifetime_earnings': float(total_lifetime_earnings),
                'average_weekly_earnings': round(average_weekly_earnings, 2),
                'average_monthly_earnings': round(average_monthly_earnings, 2),
                'total_jobs_completed': total_jobs_completed,
                'best_earning_day': best_earning_day,
                'best_earning_month': best_earning_month,
                'earnings_trend': earnings_trend,
                'trend_percentage': round(trend_percentage, 2)
            }
            
            return Response(analytics_data, status=status.HTTP_200_OK)

        except Detailer.DoesNotExist:
            return Response({"error": "Detailer profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_recent_earnings(self, request):
        """ Get recent earnings for the detailer """
        try:
            # Get the detailer for the authenticated user
            detailer = Detailer.objects.get(user=request.user)
            
            # Get recent earnings (last 20 records, ordered by most recent)
            recent_earnings = Earning.objects.filter(
                detailer=detailer
            ).select_related('job').order_by('-created_at')[:20]
            
            # Build earnings data array
            earnings_data = []
            
            for earning in recent_earnings:
                # Get payout_id if the earning is part of a payout
                payout_id = None
                if hasattr(earning, 'payouts') and earning.payouts.exists():
                    payout_id = f"payout-{earning.payouts.first().id}"
                
                earning_item = {
                    'id': str(earning.id),
                    'hourly_earnings': float(earning.hourly_earnings) if earning.hourly_earnings else float(earning.net_amount),
                    'total_active_hours': float(earning.total_active_hours) if earning.total_active_hours else 0,
                    'total_inactive_hours': float(earning.total_inactive_hours) if earning.total_inactive_hours else 0,
                    'total_earned': float(earning.net_amount),
                    'job_id': f"job-{earning.job.id}",
                    'job_reference': earning.job.booking_reference,
                    'client_name': earning.job.client_name,
                    'service_type': earning.job.service_type.name,
                    'completed_date': earning.job.created_at.isoformat(),
                    'payout_id': payout_id
                }
                
                earnings_data.append(earning_item)
            
            return Response(earnings_data, status=status.HTTP_200_OK)

        except Detailer.DoesNotExist:
            return Response({"error": "Detailer profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_payout_history(self, request):
        """ Get payout history for the detailer """
        try:
            
            # Get the detailer for the authenticated user
            detailer = Detailer.objects.get(user=request.user)
            
            # Get payout history (ordered by most recent first)
            payout_history = PayoutHistory.objects.filter(
                detailer=detailer
            ).select_related('bank_account').order_by('-created_at')
            
            # Build payout history data array
            payout_data = []
            
            for payout in payout_history:
                # Get the period dates from the earnings
                earnings = payout.earnings.all().order_by('created_at')
                period_start = earnings.first().created_at.date() if earnings.exists() else payout.created_at.date()
                period_end = earnings.last().created_at.date() if earnings.exists() else payout.created_at.date()
                
                payout_item = {
                    'id': str(payout.id),
                    'amount': float(payout.payout_amount),
                    'status': payout.status,
                    'period_start': period_start.isoformat(),
                    'period_end': period_end.isoformat(),
                    'payout_date': payout.completed_at.date().isoformat() if payout.completed_at else payout.initiated_at.date().isoformat(),
                    'bank_account': {
                        'id': str(payout.bank_account.id),
                        'account_number': payout.bank_account.account_number,
                        'account_name': payout.bank_account.account_name,
                        'bank_name': payout.bank_account.bank_name,
                        'iban': payout.bank_account.iban,
                        'bic': payout.bank_account.bic,
                        'sort_code': payout.bank_account.sort_code,
                        'is_primary': payout.bank_account.is_primary,
                        'is_verified': payout.bank_account.is_verified,
                        'created_at': payout.bank_account.created_at.isoformat(),
                        'updated_at': payout.bank_account.updated_at.isoformat()
                    },
                    'earnings_count': payout.earnings.count(),
                    'notes': payout.failure_reason if payout.status == 'failed' else None,
                    'transaction_id': payout.external_transaction_id
                }
                
                payout_data.append(payout_item)
            
            return Response(payout_data if payout_data else [], status=status.HTTP_200_OK)

        except Detailer.DoesNotExist:
            return Response({"error": "Detailer profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_bank_accounts(self, request):
        """ Get bank accounts for the detailer """
        try:
            # Get the detailer for the authenticated user
            detailer = Detailer.objects.get(user=request.user)
            
            # Get bank accounts
            bank_accounts = BankAccount.objects.filter(detailer=detailer)
            bank_accounts_data = [
                {
                    'id': str(account.id),
                    'account_number': account.account_number,
                    'account_name': account.account_name,
                    'bank_name': account.bank_name,
                    'iban': account.iban,
                    'bic': account.bic,
                    'sort_code': account.sort_code,
                    'is_primary': account.is_primary,
                    'is_verified': account.is_verified,
                    'created_at': account.created_at.isoformat(),
                    'updated_at': account.updated_at.isoformat()
                }
                for account in bank_accounts
            ]
            
            return Response(bank_accounts_data, status=status.HTTP_200_OK)

        except Detailer.DoesNotExist:
            return Response({"error": "Detailer profile not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)