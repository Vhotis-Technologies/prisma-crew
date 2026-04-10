import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Switch, Divider } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import StyledButton from "@/app/components/helpers/StyledButton";
import { useBankAccount } from "@/app/app-hooks/useBankAccount";
import { BankAccountProps } from "@/app/interfaces/BankingInterface";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";

const BankAccountScreen: React.FC = () => {
  const {
    newBankAccount,
    bankAccounts,
    handleAddBankAccount,
    handleRemoveBankAccount,
    handleSetDefaultBankAccount,
    collectBankAccountInformation,
    getUserFullName,
    isLoadingAddBankAccount,
    isLoadingSetDefaultBankAccount,
    refetchBankAccounts,
  } = useBankAccount();

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const cardColor = useThemeColor({}, "cards");

  const [isFormVisible, setIsFormVisible] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            refetchBankAccounts();
          }}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <StyledText variant="titleLarge">Bank Accounts</StyledText>
        <StyledText variant="bodySmall">
          Manage your bank accounts for payments
        </StyledText>
      </View>

      {/* Add New Account Form */}
      <View style={[styles.card]}>
        <TouchableOpacity
          onPress={() => setIsFormVisible(!isFormVisible)}
          style={styles.formHeader}
        >
          <StyledText variant="titleSmall">Add New Bank Account</StyledText>
          <Ionicons
            name={isFormVisible ? "chevron-up" : "chevron-down"}
            size={20}
            color={textColor}
          />
        </TouchableOpacity>

        {isFormVisible && (
          <View style={styles.form}>
            <StyledTextInput
              label="Account Holder Name"
              value={getUserFullName()}
              editable={false}
              info="This is your registered name"
            />

            <StyledTextInput
              label="Bank Name *"
              value={newBankAccount?.bank_name}
              onChangeText={(value) =>
                collectBankAccountInformation("bank_name", value)
              }
              placeholder="Enter bank name"
            />

            <StyledTextInput
              label="Account Number *"
              value={newBankAccount?.account_number}
              onChangeText={(value) =>
                collectBankAccountInformation("account_number", value)
              }
              placeholder="Enter account number"
              keyboardType="numeric"
            />

            <StyledTextInput
              label="IBAN *"
              value={newBankAccount?.iban}
              onChangeText={(value) =>
                collectBankAccountInformation("iban", value)
              }
              placeholder="Enter IBAN"
              autoCapitalize="characters"
            />

            <StyledTextInput
              label="BIC/SWIFT Code"
              value={newBankAccount?.bic}
              onChangeText={(value) =>
                collectBankAccountInformation("bic", value)
              }
              placeholder="Enter BIC/SWIFT code"
              autoCapitalize="characters"
            />

            <StyledTextInput
              label="Sort Code"
              value={newBankAccount?.sort_code}
              onChangeText={(value) =>
                collectBankAccountInformation("sort_code", value)
              }
              placeholder="Enter sort code (e.g., 12-34-56)"
            />

            <View style={styles.formActions}>
              <StyledButton
                variant="tonal"
                style={styles.cancelButton}
                onPress={() => setIsFormVisible(false)}
              >
                Cancel
              </StyledButton>
              <StyledButton
                onPress={handleAddBankAccount}
                style={styles.submitButton}
              >
                {isLoadingAddBankAccount ? <ActivityIndicator size="small" color={textColor} /> : "Add Account"}
              </StyledButton>
            </View>
          </View>
        )}
      </View>

      {/* Bank Accounts List */}
      <View style={styles.accountsSection}>
        <StyledText variant="labelSmall">
          Your Bank Accounts ({bankAccounts.length})
        </StyledText>

        {/* If there are no bank accounts, show the empty state */}
        {bankAccounts.length === 0 ? (
          <View
            style={[styles.card, { borderColor, backgroundColor: cardColor }]}
          >
            <View style={styles.cardContent}>
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color={textColor} />
                <StyledText variant="bodyMedium">
                  No bank accounts added yet
                </StyledText>
                <StyledText variant="bodySmall">
                  Add your first bank account to receive payments
                </StyledText>
              </View>
            </View>
          </View>
        ) : (
          bankAccounts.map((account) => (
            <View
              key={account.id}
              style={[styles.card, { borderColor, backgroundColor: cardColor }]}
            >
              <View style={styles.cardContent}>
                <View style={styles.accountHeader}>
                  <View style={styles.accountInfo}>
                    <StyledText variant="titleMedium">
                      {account.bank_name}
                    </StyledText>
                    <StyledText variant="bodyMedium">
                      ****{account.account_number.slice(-4)}
                    </StyledText>
                    <StyledText variant="bodySmall">
                      {account.account_name}
                    </StyledText>
                  </View>

                  <View style={styles.accountActions}>
                    {account.is_default && (
                      <View style={styles.defaultBadge}>
                        <StyledText variant="labelSmall">Default</StyledText>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveBankAccount(account.id!)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#FF4444"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.accountDetails}>
                  <View style={styles.detailRow}>
                    <StyledText variant="bodySmall">IBAN:</StyledText>
                    <StyledText variant="bodySmall">{account.iban}</StyledText>
                  </View>

                  {account.bic && (
                    <View style={styles.detailRow}>
                      <StyledText variant="bodySmall">BIC/SWIFT:</StyledText>
                      <StyledText variant="bodySmall">{account.bic}</StyledText>
                    </View>
                  )}

                  {account.sort_code && (
                    <View style={styles.detailRow}>
                      <StyledText variant="bodySmall">Sort Code:</StyledText>
                      <StyledText variant="bodySmall">
                        {account.sort_code}
                      </StyledText>
                    </View>
                  )}
                </View>

                {!account.is_default && (
                  <View style={styles.setDefaultSection}>
                    <StyledText variant="bodySmall">
                      Set as default account
                    </StyledText>
                    <Switch
                      value={isLoadingSetDefaultBankAccount ? false : account.is_default}
                      onValueChange={() =>
                        handleSetDefaultBankAccount(account.id!)
                      }
                    />
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 5,
  },
  header: {
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
  },
  card: {
    marginBottom: 10,
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical:5,
  },
  cardContent: {
    padding: 5,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 4,
  },
  formTitle: {
    fontWeight: "600",
  },
  form: {
    gap: 16,
  },
  formActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  accountsSection: {
    padding: 5,
    marginTop: 8,
    gap: 10,
    paddingBottom: 70,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: 8,
    opacity: 0.7,
    textAlign: "center",
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  accountInfo: {
    flex: 1,
  },
  bankName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  accountNumber: {
    marginBottom: 2,
  },
  accountName: {
    opacity: 0.7,
  },
  accountActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  defaultBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  defaultText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  deleteButton: {
    padding: 4,
  },
  divider: {
    marginVertical: 12,
  },
  accountDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontWeight: "500",
    opacity: 0.7,
  },
  detailValue: {
    fontFamily: "SpaceMonoRegular",
  },
  setDefaultSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  setDefaultText: {
    fontWeight: "500",
  },
});

export default BankAccountScreen;
