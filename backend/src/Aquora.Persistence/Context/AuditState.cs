using System.Threading;

namespace Aquora.Persistence.Context
{
    public static class AuditState
    {
        private static readonly AsyncLocal<bool> _isDisabled = new AsyncLocal<bool>();

        public static bool IsDisabled
        {
            get => _isDisabled.Value;
            set => _isDisabled.Value = value;
        }
    }
}
