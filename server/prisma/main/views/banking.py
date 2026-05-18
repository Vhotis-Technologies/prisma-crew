from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.exceptions import ValidationError
from main.models import BankAccount, Detailer
from main.tasks import send_push_notification

class BankingView(APIView):
    permission_classes = [IsAuthenticated]

    action_handler = {
        "get_bank_accounts": "_get_bank_accounts",
        "create_bank_account": "_create_bank_account",
        'delete_bank_account': '_delete_bank_account',
        'set_default_bank_account': '_set_default_bank_account',
    }

    def get(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def post(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def delete(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)   
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def patch(self, request, *args, **kwargs):
        action = kwargs.get('action')
        if action not in self.action_handler:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        handler = getattr(self, self.action_handler[action])
        return handler(request)
    
    def _get_bank_accounts(self, request):
        try:
            """ TODO: Only get bank accounts that are verified """
            bank_accounts = BankAccount.objects.filter(detailer__user=request.user)
            bank_account_data = []
            for bank_account in bank_accounts:
                bank_account_data.append({
                    'id': bank_account.id,
                    'account_name': bank_account.account_name,
                    'iban': bank_account.iban,
                    'is_default': bank_account.is_primary,
                })
            if not bank_account_data:
                return Response([], status=status.HTTP_200_OK)
            return Response(bank_account_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
    
    def _create_bank_account(self, request):
        try:
            detailer = Detailer.objects.get(user=request.user)
        except Detailer.DoesNotExist:
            return Response({"error": "Detailer not found"}, status=status.HTTP_404_NOT_FOUND)
        # before an account is created, check how many accounts are already in the db
        # if the user has more than 2 bank accounts, return message letting them know that they can not
        # create more than 2 bank accounts
        try:
            if BankAccount.objects.filter(detailer=detailer, is_verified=True).count() >= 2:
                    return Response({"error": "You can not add more than 2 bank accounts"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        try:
            bank_account_data = request.data.get('bankAccountData')

            if not bank_account_data:
                return Response({"error": "Bank account data is required"}, status=status.HTTP_400_BAD_REQUEST)

            account_name = (bank_account_data.get('account_name') or '').strip()
            iban_raw = (bank_account_data.get('iban') or '').strip()
            iban_clean = iban_raw.replace(' ', '').upper()

            missing_fields = []
            if not account_name:
                missing_fields.append('account_name')
            if not iban_clean:
                missing_fields.append('iban')
            if missing_fields:
                return Response(
                    {"error": f"Missing required fields: {', '.join(missing_fields)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            bank_account = BankAccount.objects.create(
                detailer=detailer,
                account_name=account_name,
                iban=iban_clean,
            )

            if BankAccount.objects.filter(detailer=detailer).count() == 1:
                bank_account.is_primary = True
                bank_account.save()

            iban_masked = '****' + iban_clean[-4:] if len(iban_clean) >= 4 else '****'
            send_push_notification.delay(
                request.user.id,
                "Security Alert",
                f"A new bank account ({iban_masked}) has been added to your account.",
                "bank_account"
            )

            return Response({
                "message": f'{bank_account.account_name} created successfully',
                "account_name": bank_account.account_name
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Failed to create bank account: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


    def _delete_bank_account(self, request):
        try:
            account_id = request.data.get('accountId')
            if not account_id:
                return Response({"error": "Account ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            try:
                bank_account = BankAccount.objects.get(id=account_id, detailer__user=request.user)
            except BankAccount.DoesNotExist:
                return Response({"error": "Bank account not found"}, status=status.HTTP_404_NOT_FOUND)
            
            if bank_account.is_primary:
                return Response({"error": "Primary bank account cannot be deleted, please set another bank account as the primary bank account first"}, status=status.HTTP_400_BAD_REQUEST)
            
            account_name = bank_account.account_name
            bank_account.delete()
            return Response({"message": f"{account_name} deleted successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            pass
            return Response({"error": f"Failed to delete bank account: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        

    def _set_default_bank_account(self, request):
        try:
            account_id = request.data.get('accountId')
            if not account_id:
                return Response({"error": "Account ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # check if the account if valid and on the db
            try:
                bank_account = BankAccount.objects.get(id=account_id, detailer__user=request.user)
            except BankAccount.DoesNotExist:
                return Response({"error": "Bank account not found"}, status=status.HTTP_404_NOT_FOUND)
            
            # Set all other accounts to non-primary first
            BankAccount.objects.filter(detailer__user=request.user).update(is_primary=False)
            bank_account.is_primary = True
            bank_account.save()
            
            iban_masked = (
                '****' + bank_account.iban[-4:]
                if bank_account.iban and len(bank_account.iban) >= 4
                else '****'
            )
            send_push_notification.delay(
                request.user.id,
                "Security Alert",
                f"{bank_account.account_name} ({iban_masked}) is now your primary bank account.",
                "bank_account"
            )
            return Response({"message": f"{bank_account.account_name} set as primary successfully"}, status=status.HTTP_200_OK)
        except Exception as e:
            pass
            return Response({"error": f"Failed to set default bank account: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)